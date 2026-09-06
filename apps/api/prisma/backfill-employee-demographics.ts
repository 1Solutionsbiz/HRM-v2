// One-off backfill: gender/nationality/religion/maritalStatus/bloodGroup for
// all 41 employees. These columns exist in `hrm_employee` and the V2 schema
// has carried matching fields since the 2026-09-05 personal-details
// migration, but no import script ever wrote to them - Phase 1 predates the
// schema addition, and nothing followed up. Found live: every employee's
// detail page showed "-" for these four fields (Gender/Nationality/
// Religion/Marital status/Blood group), reported for Aditya Srivastava but
// true for all 41.
//
// Code mappings verified against hrmpulse.com's own rendered profile pages
// (never guessed): gender 1=Male confirmed via Aditya/Shivam/Atul (all
// legacy gender=1), 2=Female confirmed via Ritika/Nikita (legacy gender=2).
// marital_status 2="Unmarried" confirmed via Aditya's own profile page,
// 1="Married" confirmed via Shivam's. Neither DIVORCED nor WIDOWED appears
// anywhere in this 41-row dataset. `bgroup`/`religion`/`nationality` are
// free text in legacy; religion/nationality map straight through to V2's
// free-text fields (empty/'0'/'NULL' -> null), only re-cased for the
// inconsistent capitalization actually present ("hindu" vs "Hindu").
//
// Run: npx tsx --env-file=<path-to-hrm-api.env> prisma/backfill-employee-demographics.ts <path-to-dump.sql>
import { readFileSync, writeFileSync } from 'node:fs';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client.js';
import type { Gender, MaritalStatus, BloodGroup } from '../src/generated/prisma/enums.js';

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
  return t === '' || t.toUpperCase() === 'NULL' || t === '0';
}

const GENDER_MAP: Record<string, Gender> = { '1': 'MALE', '2': 'FEMALE' };
const MARITAL_MAP: Record<string, MaritalStatus> = { '1': 'MARRIED', '2': 'SINGLE' };
const BLOOD_GROUP_MAP: Record<string, BloodGroup> = {
  'a positive': 'A_POSITIVE',
  'a negative': 'A_NEGATIVE',
  'b positive': 'B_POSITIVE',
  'b negative': 'B_NEGATIVE',
  'ab positive': 'AB_POSITIVE',
  'ab negative': 'AB_NEGATIVE',
  'o positive': 'O_POSITIVE',
  'o negative': 'O_NEGATIVE',
};

function titleCase(v: string): string {
  return v.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

async function main() {
  const dumpPath = process.argv[2];
  if (!dumpPath) {
    console.error('usage: tsx backfill-employee-demographics.ts <path-to-dump.sql>');
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
  let skippedNoEmployee = 0;

  for (const e of legacyEmployees) {
    const legacyId = e.id!.trim();
    const code = legacyIdToEmployeeCode.get(legacyId)!;
    const employee = codeToEmployee.get(code);
    if (!employee) {
      skippedNoEmployee++;
      report.push(`SKIPPED legacy id=${legacyId} ${e.fname} ${e.lname}: no matching V2 employee.`);
      continue;
    }

    const genderCode = e.gender?.trim();
    const gender = genderCode ? (GENDER_MAP[genderCode] ?? null) : null;
    if (genderCode && !gender) {
      report.push(`NOTE ${employee.firstName} ${employee.lastName}: unmapped gender code "${genderCode}".`);
    }

    const maritalCode = e.marital_status?.trim();
    const maritalStatus = maritalCode ? (MARITAL_MAP[maritalCode] ?? null) : null;
    if (maritalCode && !maritalStatus) {
      report.push(
        `NOTE ${employee.firstName} ${employee.lastName}: unmapped marital_status code "${maritalCode}".`,
      );
    }

    const bgroupRaw = isNullish(e.bgroup) || e.bgroup!.trim().toLowerCase() === 'not select' ? null : e.bgroup!.trim();
    const bloodGroup = bgroupRaw ? (BLOOD_GROUP_MAP[bgroupRaw.toLowerCase()] ?? null) : null;
    if (bgroupRaw && !bloodGroup) {
      report.push(`NOTE ${employee.firstName} ${employee.lastName}: unmapped bgroup value "${bgroupRaw}".`);
    }

    const religion = isNullish(e.religion) ? null : titleCase(e.religion!.trim());
    const nationality = isNullish(e.nationality) ? null : titleCase(e.nationality!.trim());

    await prisma.employee.update({
      where: { id: employee.id },
      data: { gender, maritalStatus, bloodGroup, religion, nationality },
    });
    updated++;
  }

  report.push(`\nUpdated: ${updated}`);
  report.push(`Skipped (no matching employee): ${skippedNoEmployee}`);

  const reportPath = `${dumpPath}.demographics-backfill-report.txt`;
  writeFileSync(reportPath, report.join('\n') + '\n');
  console.log(report.join('\n'));
  console.log(`\nReport written to ${reportPath}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
