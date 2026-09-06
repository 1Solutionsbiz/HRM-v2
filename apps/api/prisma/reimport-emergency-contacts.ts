// One-off re-import: ALL legacy emergency contacts, not just one "best"
// contact per employee. Phase 1's import predates today's schema migration
// (20260906030459_allow_multiple_emergency_contacts) that dropped
// EmployeeEmergencyContact's 1:1 `@unique(employeeId)` - at the time, V2
// could only hold one row per employee, so Phase 1 kept the "best" contact
// and silently dropped the rest (documented in PROJECT_STATUS.md's "known,
// permanent structural gaps"). That gap is now closed: `hrm_employee_family`
// has 24 rows across 21 employees (19 with one contact, 1 with two, 1 with
// three) - all 24 should exist in V2.
//
// `relationship_id` is a foreign key into `hrm_family_relationship_member`
// (Father/Mother/Husband/Wife/Son/Daughter/Brother/Sister/Friend) - resolved
// here, not hardcoded, so a relationship this dump doesn't happen to use
// still imports correctly if the dump changes.
//
// Wipes and fully re-creates every EmployeeEmergencyContact row (this table
// has no live-UI write path yet - see employees.controller.ts's emergency-
// contact routes, unused by any current frontend page - so there's no real
// user data to preserve/merge).
//
// Run: npx tsx --env-file=<path-to-hrm-api.env> prisma/reimport-emergency-contacts.ts <path-to-dump.sql>
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

async function main() {
  const dumpPath = process.argv[2];
  if (!dumpPath) {
    console.error('usage: tsx reimport-emergency-contacts.ts <path-to-dump.sql>');
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

  const relationships = parseTable(sql, 'hrm_family_relationship_member');
  const relationshipById = new Map(relationships.map((r) => [r.id!.trim(), r.name!.trim()]));

  const family = parseTable(sql, 'hrm_employee_family');
  report.push(`Source rows: ${family.length}`);

  const deleted = await prisma.employeeEmergencyContact.deleteMany({});
  report.push(`Wiped ${deleted.count} previously-imported rows.`);

  let imported = 0;
  let skipped = 0;
  const perEmployee = new Map<string, number>();

  for (const f of family) {
    const legacyEmployeeId = f.emp_id!.trim();
    const code = legacyIdToEmployeeCode.get(legacyEmployeeId);
    const employee = code ? codeToEmployee.get(code) : undefined;
    if (!employee) {
      skipped++;
      report.push(
        `SKIPPED family row id=${f.id}: legacy emp_id ${legacyEmployeeId} has no matching V2 employee.`,
      );
      continue;
    }
    const relationship = relationshipById.get(f.relationship_id!.trim()) ?? f.relationship_id!.trim();

    await prisma.employeeEmergencyContact.create({
      data: {
        employeeId: employee.id,
        name: f.name!.trim(),
        relationship,
        phone: f.phone!.trim(),
      },
    });
    imported++;
    const key = `${employee.firstName} ${employee.lastName}`;
    perEmployee.set(key, (perEmployee.get(key) ?? 0) + 1);
  }

  report.push(`Imported: ${imported}`);
  report.push(`Skipped (no matching employee): ${skipped}`);
  report.push('Contacts per employee:');
  for (const [name, count] of [...perEmployee.entries()].sort((a, b) => b[1] - a[1])) {
    report.push(`  ${name}: ${count}`);
  }

  const reportPath = `${dumpPath}.emergency-contacts-reimport-report.txt`;
  writeFileSync(reportPath, report.join('\n') + '\n');
  console.log(report.join('\n'));
  console.log(`\nReport written to ${reportPath}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
