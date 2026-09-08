// One-off: import the 44 real historical support tickets + 41 comments
// from the legacy PHP HRM. Parses a phpMyAdmin dump directly rather than
// executing it (same approach as import-legacy-spine.ts), so the dump
// itself never has to be committed to git - it's read from a path given
// on the command line, not embedded in this file. No V2 ticket model
// existed when the original Phase 1-3 imports ran (TicketModule was built
// 2026-09-07), so this data was never pulled in - see PROJECT_STATUS.md's
// "Legacy data completeness" audit, which first found the 44-row gap.
//
// Idempotent: skips any legacy TicketID already recorded (via a
// `[legacy:<TicketID>]` marker appended to the description - the only
// place to park it without a schema change, matching this project's
// convention of not adding a column for a one-off migration concern).
//
// Run: npx tsx --env-file=<path-to-hrm-api.env> prisma/import-legacy-tickets.ts <path-to-dump.sql>
import { readFileSync } from 'node:fs';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client.js';

type Row = Record<string, string>;

function extractInsertBlock(sql: string, table: string): { cols: string[]; body: string } | null {
  const re = new RegExp(
    `INSERT INTO \`${table}\`\\s*\\(([^)]*)\\)\\s*VALUES\\s*\\n([\\s\\S]*?);\\n`,
  );
  const m = re.exec(sql);
  if (!m) return null;
  const cols = m[1]!.split(',').map((c) => c.trim().replace(/`/g, ''));
  return { cols, body: m[2]! };
}

// This dump backslash-escapes quotes/newlines (`Ma\'am`, `\r\n`) rather
// than doubling quotes - a different mysqldump mode than the earlier
// legacy dumps import-legacy-spine.ts's parseSqlRow was written for, so
// that helper isn't reused here; this one specifically un-escapes `\'`,
// `\"`, `\\`, `\r`, `\n`.
function parseSqlRow(row: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (inQuote && c === '\\') {
      const next = row[i + 1];
      const map: Record<string, string> = { "'": "'", '"': '"', '\\': '\\', r: '\r', n: '\n' };
      cur += next !== undefined && next in map ? map[next] : (next ?? '');
      i++;
      continue;
    }
    if (c === "'") {
      inQuote = !inQuote;
      continue;
    }
    if (c === ',' && !inQuote) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseTable(sql: string, table: string): Row[] {
  const block = extractInsertBlock(sql, table);
  if (!block) return [];
  let body = block.body.trim();
  if (body.startsWith('(')) body = body.slice(1);
  if (body.endsWith(')')) body = body.slice(0, -1);
  const rawRows = body.split('),\n(');
  return rawRows.map((r) => {
    const values = parseSqlRow(r);
    const row: Row = {};
    block.cols.forEach((c, i) => (row[c] = values[i] ?? ''));
    return row;
  });
}

function isNullish(v: string | undefined): boolean {
  if (v === undefined) return true;
  const t = v.trim();
  return t === '' || t.toUpperCase() === 'NULL';
}

const CATEGORY_MAP: Record<string, string> = {
  '1': 'SALARY_OR_PAYMENT',
  '2': 'LEAVE_OR_ATTENDANCE',
  '4': 'OFFICE_FACILITIES',
  '5': 'GENERAL_QUERIES',
  '6': 'RECRUITMENT_OR_JOINING',
  '7': 'EXIT_FORMALITIES',
  '8': 'COMPLAINT',
  '9': 'MISPUNCH',
};

const PRIORITY_MAP: Record<string, string> = { Low: 'LOW', Medium: 'MEDIUM', High: 'HIGH' };
const STATUS_MAP: Record<string, string> = { Closed: 'CLOSED', Resolved: 'RESOLVED' };

function legacyMarker(ticketId: string): string {
  return `[legacy:${ticketId}]`;
}

/**
 * A first run of this script stalled indefinitely on a query (0% CPU, no
 * error, no progress for 30+ minutes) - almost certainly a dropped/idle
 * connection to the remote host that the driver never surfaced as an
 * error. Wrapping every await in a timeout turns a silent hang into a
 * loud, catchable failure instead of blocking the whole run forever.
 */
function withTimeout<T>(promise: Promise<T>, label: string, ms = 20_000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms: ${label}`)), ms),
    ),
  ]);
}

/**
 * "YYYY-MM-DD HH:MM:SS" IST wall-clock -> true UTC instant (IST = UTC+5:30).
 * Same conversion as import-legacy-attendance-history.ts /
 * import-legacy-leaves-gap-fill.ts - this dump comes from the same IST
 * host, so `new Date(str)` (which would silently adopt this process's own
 * timezone) or a naive "+Z" suffix would both be wrong.
 */
function parseIstTimestamp(value: string): Date {
  const [datePart, timePart] = value.split(' ');
  const [y, mo, d] = datePart!.split('-').map(Number);
  const [h, mi, s] = (timePart ?? '00:00:00').split(':').map(Number);
  return new Date(Date.UTC(y!, mo! - 1, d!, h! - 5, mi! - 30, s ?? 0));
}

async function main() {
  const dumpPath = process.argv[2];
  if (!dumpPath) {
    console.error('usage: tsx import-legacy-tickets.ts <path-to-dump.sql>');
    process.exit(1);
  }
  const sql = readFileSync(dumpPath, 'utf8');

  const legacyTickets = parseTable(sql, 'tickets');
  const legacyComments = parseTable(sql, 'ticket_comments');
  const legacyEmployees = parseTable(sql, 'hrm_employee');
  const empCodeById = new Map<string, string>();
  for (const e of legacyEmployees) {
    if (!isNullish(e.id) && !isNullish(e.emp_id)) empCodeById.set(e.id!, e.emp_id!);
  }

  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL as string) });

  // employeeCode -> real V2 Employee (id, userId), built once.
  const employees = await withTimeout(
    prisma.employee.findMany({ select: { id: true, userId: true, employeeCode: true } }),
    'employee.findMany',
  );
  const byCode = new Map(employees.map((e) => [e.employeeCode, e]));

  // Already-imported legacy ticket ids, built once up front (avoids a
  // findFirst round trip per ticket, and matches the marker exactly
  // instead of relying on `endsWith` re-scanning description text).
  const existingTickets = await withTimeout(
    prisma.ticket.findMany({ select: { description: true } }),
    'ticket.findMany (existing)',
  );
  const alreadyImported = new Set(
    existingTickets
      .map((t) => /\[legacy:(\d+)\]$/.exec(t.description)?.[1])
      .filter((id): id is string => !!id),
  );

  let created = 0;
  let skippedExisting = 0;
  let skippedUnresolved = 0;
  let commentsCreated = 0;

  legacyTickets.sort((a, b) => Number(a.TicketID) - Number(b.TicketID));

  for (const t of legacyTickets) {
    const ticketId = t.TicketID!;
    const marker = legacyMarker(ticketId);
    if (alreadyImported.has(ticketId)) {
      skippedExisting++;
      continue;
    }

    const empCode = empCodeById.get(t.EmployeeID!);
    const employee = empCode ? byCode.get(empCode) : undefined;
    if (!employee) {
      console.log(`Skipping legacy ticket ${ticketId} - EmployeeID ${t.EmployeeID} has no resolvable V2 employee.`);
      skippedUnresolved++;
      continue;
    }

    const category = CATEGORY_MAP[t.CategoryID!];
    const priority = PRIORITY_MAP[t.Priority!] ?? 'LOW';
    const status = STATUS_MAP[t.Status!] ?? 'CLOSED';
    if (!category) {
      console.log(`Skipping legacy ticket ${ticketId} - unknown CategoryID ${t.CategoryID}.`);
      skippedUnresolved++;
      continue;
    }

    const createdAt = parseIstTimestamp(t.CreatedAt!);
    const updatedAt = parseIstTimestamp(t.UpdatedAt!);

    const sequence = await withTimeout(
      prisma.sequenceCounter.update({
        where: { key: 'ticketCode' },
        data: { value: { increment: 1 } },
      }),
      `sequenceCounter.update (ticket ${ticketId})`,
    );
    const code = `TKT-${String(sequence.value).padStart(4, '0')}`;

    const ticket = await withTimeout(
      prisma.ticket.create({
        data: {
          code,
          employeeId: employee.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          category: category as any,
          title: t.Title!,
          description: `${t.Description}\n\n${marker}`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          priority: priority as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: status as any,
          resolvedAt: status === 'RESOLVED' ? updatedAt : null,
          closedAt: status === 'CLOSED' ? updatedAt : null,
          createdAt,
          updatedAt,
        },
      }),
      `ticket.create (${code})`,
    );
    created++;

    const ticketComments = legacyComments
      .filter((c) => c.ticket_id === ticketId)
      .sort((a, b) => Number(a.id) - Number(b.id));
    for (const c of ticketComments) {
      const authorCode = empCodeById.get(c.commented_by!);
      const author = authorCode ? byCode.get(authorCode) : undefined;
      if (!author) {
        console.log(`  Skipping comment ${c.id} on ticket ${ticketId} - commented_by ${c.commented_by} unresolved.`);
        continue;
      }
      await withTimeout(
        prisma.ticketComment.create({
          data: {
            ticketId: ticket.id,
            authorUserId: author.userId,
            body: c.comment!,
            createdAt: parseIstTimestamp(c.created_at!),
          },
        }),
        `ticketComment.create (comment ${c.id})`,
      );
      commentsCreated++;
    }

    console.log(`Imported ${code} (legacy #${ticketId}) - ${t.Title}`);
  }

  console.log(
    `\nDone. Created ${created} tickets (${commentsCreated} comments), skipped ${skippedExisting} already-imported, ${skippedUnresolved} unresolved.`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
