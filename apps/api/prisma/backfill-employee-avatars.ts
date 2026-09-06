// One-off backfill: employee profile photos. `hrm_employee.image` holds a
// filename (35 of 41 employees have one); the actual files are served from
// legacy at `https://hrmpulse.com/upload-image/<filename>` (confirmed live -
// not guessed - by reading the real <img src> on hrmpulse.com's own
// rendered profile pages). No import script has ever touched
// `Employee.avatarUrl`, and no frontend page has ever rendered
// `AvatarImage` - both are new as of this pass.
//
// This hotlinks to the legacy host rather than downloading and re-hosting
// the files: V2 has no file storage provider wired yet (see
// PROJECT_STATUS.md's "Not started" list), and some of these images are
// multi-megabyte (Atul Chaudhary's is 2.2MB), too large to embed as a data
// URI on every employee-list row. This is a real dependency on
// hrmpulse.com staying reachable - flagged in PROJECT_STATUS.md, not
// silently assumed permanent.
//
// Run: npx tsx --env-file=<path-to-hrm-api.env> prisma/backfill-employee-avatars.ts <path-to-dump.sql>
import { readFileSync, writeFileSync } from 'node:fs';
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

function parseSqlRow(row: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (c === "'" && !inQuote) {
      inQuote = true;
    } else if (c === "'" && inQuote) {
      if (row[i + 1] === "'") {
        cur += "'";
        i++;
      } else {
        inQuote = false;
      }
    } else if (c === ',' && !inQuote) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
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

async function main() {
  const dumpPath = process.argv[2];
  if (!dumpPath) {
    console.error('usage: tsx backfill-employee-avatars.ts <path-to-dump.sql>');
    process.exit(1);
  }
  const sql = readFileSync(dumpPath, 'utf8');
  const report: string[] = [];

  const adapter = new PrismaMariaDb(process.env.DATABASE_URL as string);
  const prisma = new PrismaClient({ adapter });

  // ---- rebuild legacy id -> V2 Employee (same rule Phase 1 used) ----
  const legacyEmployees = parseTable(sql, 'hrm_employee');
  const usedEmployeeCodes = new Set<string>();
  const legacyIdToEmployeeCode = new Map<string, string>();
  for (const e of legacyEmployees) {
    const legacyId = e.id!.trim();
    let code = e.emp_id!.trim();
    if (!code || usedEmployeeCodes.has(code)) code = `LEGACY-${legacyId}`;
    usedEmployeeCodes.add(code);
    legacyIdToEmployeeCode.set(legacyId, code);
  }
  const employees = await prisma.employee.findMany({
    select: { id: true, employeeCode: true, firstName: true, lastName: true },
  });
  const codeToEmployee = new Map(employees.map((e) => [e.employeeCode, e]));

  let updated = 0;
  let skippedNoImage = 0;
  let skippedNoEmployee = 0;

  for (const e of legacyEmployees) {
    const legacyId = e.id!.trim();
    if (isNullish(e.image)) {
      skippedNoImage++;
      continue;
    }
    const code = legacyIdToEmployeeCode.get(legacyId)!;
    const employee = codeToEmployee.get(code);
    if (!employee) {
      skippedNoEmployee++;
      report.push(`SKIPPED legacy id=${legacyId} ${e.fname} ${e.lname}: no matching V2 employee.`);
      continue;
    }

    const avatarUrl = `https://hrmpulse.com/upload-image/${encodeURIComponent(e.image!.trim())}`;
    await prisma.employee.update({ where: { id: employee.id }, data: { avatarUrl } });
    updated++;
  }

  report.push(`Updated: ${updated}`);
  report.push(`Skipped (no image in legacy): ${skippedNoImage}`);
  report.push(`Skipped (no matching employee): ${skippedNoEmployee}`);

  const reportPath = `${dumpPath}.avatars-backfill-report.txt`;
  writeFileSync(reportPath, report.join('\n') + '\n');
  console.log(report.join('\n'));
  console.log(`\nReport written to ${reportPath}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
