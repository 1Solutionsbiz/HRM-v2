// One-off legacy-data import (Phase 1: "spine" only — company, departments,
// designations, users+employees, manager links, roles, employeeCode sequence
// counters). Parses a phpMyAdmin dump directly rather than executing it, so
// none of the legacy app's 87 tables ever touch the V2 schema (see
// database-design.md for why V2 is a deliberate redesign, not a port).
//
// Idempotent: deletes everything it owns before re-inserting, so it can be
// re-run against a newer dump without hand-written upsert/natural-key logic.
// It never touches Role/Permission/RolePermission or the pre-existing admin
// User — those are seeded separately and preserved by email match.
//
// Run: DATABASE_URL=... npx tsx prisma/import-legacy-spine.ts <path-to-dump.sql>
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PasswordService } from '../src/security/password.service.js';

const PRESERVED_ADMIN_EMAIL = 'atul@1solutions.biz';
// hrm_designation.department_name is free text and wrong for this one row
// ("Select Department") — ground truth is the department_id actually held
// by the employees who carry this designation (see recon: Atul Chaudhary,
// legacy id 14, designation_id 10, department_id 1 "Development").
const DIRECTOR_DESIGNATION_LEGACY_ID = '10';
const DIRECTOR_DEPARTMENT_LEGACY_ID = '1';
// designation ids whose title implies the HR role (legacy has no role
// enum value for this — "user" covers both ordinary staff and HR staff).
const HR_DESIGNATION_LEGACY_IDS = new Set(['9', '16']);

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

function parseDateOrNull(v: string | undefined): Date | null {
  if (isNullish(v)) return null;
  const t = v!.trim();
  if (t === '0000-00-00' || t.startsWith('0000-00-00')) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function main() {
  const dumpPath = process.argv[2];
  if (!dumpPath) {
    console.error('usage: tsx import-legacy-spine.ts <path-to-dump.sql>');
    process.exit(1);
  }
  const sql = readFileSync(dumpPath, 'utf8');

  const legacyDepartments = parseTable(sql, 'hrm_department');
  const legacyDesignations = parseTable(sql, 'hrm_designation');
  const legacyEmployees = parseTable(sql, 'hrm_employee');
  const legacyReportingManagers = parseTable(sql, 'hrm_reporting_manager');
  const legacyCompanies = parseTable(sql, 'companies');

  console.log(
    `Parsed: ${legacyDepartments.length} departments, ${legacyDesignations.length} designations, ` +
      `${legacyEmployees.length} employees, ${legacyReportingManagers.length} reporting-manager rows, ` +
      `${legacyCompanies.length} companies`,
  );

  const adapter = new PrismaMariaDb(process.env.DATABASE_URL as string);
  const prisma = new PrismaClient({ adapter });
  const passwordService = new PasswordService();
  const report: string[] = [];

  const preservedAdmin = await prisma.user.findFirstOrThrow({
    where: { email: PRESERVED_ADMIN_EMAIL },
  });
  console.log(`Preserving existing admin user: ${preservedAdmin.email} (${preservedAdmin.id})`);

  // ---- wipe scope (idempotent re-run) ----
  await prisma.employee.deleteMany({});
  await prisma.userRole.deleteMany({ where: { userId: { not: preservedAdmin.id } } });
  await prisma.user.deleteMany({ where: { id: { not: preservedAdmin.id } } });
  await prisma.designation.deleteMany({});
  await prisma.department.deleteMany({});
  await prisma.companySettings.deleteMany({});
  console.log('Wiped previously-imported spine data (admin user/role preserved).');

  // ---- sequence counters (infra, not demo data — required for the API's
  // own employeeCode/leaveRequestCode/etc. generators to work at all) ----
  for (const key of ['employeeCode', 'leaveRequestCode', 'expenseClaimCode', 'payslipCode']) {
    await prisma.sequenceCounter.upsert({
      where: { key },
      create: { key, value: 0 },
      update: {},
    });
  }

  // ---- company settings ----
  const co = legacyCompanies[0];
  if (co) {
    const address = [co.address1, co.address2].filter((s) => s && !isNullish(s)).join(', ');
    await prisma.companySettings.create({
      data: {
        id: 'singleton',
        legalName: co.name!.trim(),
        brandName: co.name!.trim(),
        website: isNullish(co.website) ? null : co.website!.trim(),
        supportEmail: co.email!.trim(),
        phone: isNullish(co.mobile1) ? null : co.mobile1!.trim(),
        address: address || null,
      },
    });
    console.log(`CompanySettings created from legacy company "${co.name!.trim()}".`);
  }

  // ---- departments ----
  const deptLegacyToNew = new Map<string, string>();
  const deptNameToNew = new Map<string, string>();
  for (const d of legacyDepartments) {
    const created = await prisma.department.create({
      data: { name: d.name!.trim(), code: isNullish(d.code) ? null : d.code!.trim() },
    });
    deptLegacyToNew.set(d.id!.trim(), created.id);
    deptNameToNew.set(d.name!.trim().toLowerCase(), created.id);
  }
  console.log(`Imported ${deptLegacyToNew.size} departments.`);

  // ---- designations ----
  const desigLegacyToNew = new Map<string, string>();
  for (const de of legacyDesignations) {
    const legacyId = de.id!.trim();
    let deptId: string | undefined;
    if (legacyId === DIRECTOR_DESIGNATION_LEGACY_ID) {
      deptId = deptLegacyToNew.get(DIRECTOR_DEPARTMENT_LEGACY_ID);
      report.push(
        `Designation "${de.name!.trim()}" (legacy id ${legacyId}): legacy department_name was ` +
          `"Select Department" (placeholder) — resolved via actual employee data instead.`,
      );
    } else {
      deptId = deptNameToNew.get(de.department_name!.trim().toLowerCase());
    }
    if (!deptId) {
      report.push(
        `SKIPPED designation "${de.name!.trim()}" (legacy id ${legacyId}): no matching department ` +
          `for department_name "${de.department_name}".`,
      );
      continue;
    }
    const created = await prisma.designation.create({
      data: { title: de.name!.trim(), departmentId: deptId },
    });
    desigLegacyToNew.set(legacyId, created.id);
  }
  console.log(`Imported ${desigLegacyToNew.size} designations.`);

  // ---- roles lookup ----
  const roles = await prisma.role.findMany();
  const roleIdByKey = new Map(roles.map((r) => [r.key, r.id]));

  // ---- resolve primary manager per employee (latest by date, skip self-refs) ----
  const primaryManagerByEmp = new Map<string, { managerLegacyId: string; date: string }>();
  for (const rm of legacyReportingManagers) {
    if (rm.reporting_manager_type!.trim() !== 'Primary') continue;
    const empId = rm.employee_id!.trim();
    const mgrId = rm.reporting_manager_id!.trim();
    if (empId === mgrId) continue;
    const existing = primaryManagerByEmp.get(empId);
    if (!existing || rm.date! > existing.date) {
      primaryManagerByEmp.set(empId, { managerLegacyId: mgrId, date: rm.date! });
    }
  }
  const managerLegacyIds = new Set(
    [...primaryManagerByEmp.values()].map((v) => v.managerLegacyId),
  );

  // ---- employees ----
  const legacyIdToNewEmployeeId = new Map<string, string>();
  const usedEmployeeCodes = new Set<string>();
  let created = 0;
  let reusedAdminUser = 0;
  for (const e of legacyEmployees) {
    const legacyId = e.id!.trim();
    const officeEmail = isNullish(e.office_email) ? null : e.office_email!.trim();
    const personalEmailRaw = isNullish(e.email) ? null : e.email!.trim();
    let loginEmail = officeEmail ?? personalEmailRaw;
    if (!loginEmail) {
      loginEmail = `legacy-import-${legacyId}@1solutions.biz.invalid`;
      report.push(
        `id=${legacyId} ${e.fname} ${e.lname}: no email in legacy data at all — placeholder ` +
          `login "${loginEmail}" assigned, needs a real email set manually.`,
      );
    }

    let doj = parseDateOrNull(e.doj);
    if (!doj) {
      doj = new Date('2000-01-01');
      report.push(
        `id=${legacyId} ${e.fname} ${e.lname}: doj missing/invalid in legacy data — defaulted to ` +
          `2000-01-01, needs manual correction.`,
      );
    }

    const status = e.status?.trim() === '1' ? 'ACTIVE' : 'INACTIVE';
    let employmentType: 'FULL_TIME' | 'PART_TIME' | 'INTERN' = 'FULL_TIME';
    if (e.candidate_type?.trim() === 'Intern (3 Months)') employmentType = 'INTERN';
    else if (e.employee_type?.trim() === 'Part Time') employmentType = 'PART_TIME';

    // Password hashing: never log the raw value.
    const rawPassword = isNullish(e.password) ? null : e.password!.trim();
    const passwordHash = await passwordService.hash(rawPassword ?? randomUUID());
    if (!rawPassword) {
      report.push(
        `id=${legacyId} ${e.fname} ${e.lname}: no legacy password on record — account created with ` +
          `an unguessable random hash (nobody knows it); needs a manual reset once that flow exists.`,
      );
    }

    let userId: string;
    if (loginEmail.toLowerCase() === PRESERVED_ADMIN_EMAIL.toLowerCase()) {
      userId = preservedAdmin.id;
      reusedAdminUser++;
    } else {
      const user = await prisma.user.create({
        data: { email: loginEmail, passwordHash, isActive: status === 'ACTIVE' },
      });
      userId = user.id;

      const roleKeys = new Set<string>(['employee']);
      const legacyRole = e.role?.trim();
      if (legacyRole === 'super admin' || legacyRole === 'admin') roleKeys.add('admin');
      if (managerLegacyIds.has(legacyId)) roleKeys.add('manager');
      if (HR_DESIGNATION_LEGACY_IDS.has(e.designation_id?.trim() ?? '')) roleKeys.add('hr');

      for (const key of roleKeys) {
        const roleId = roleIdByKey.get(key);
        if (roleId) await prisma.userRole.create({ data: { userId, roleId } });
      }
    }

    const deptLegacy = e.department_id?.trim();
    const desigLegacy = e.designation_id?.trim();
    const departmentId =
      deptLegacy && deptLegacy !== '0' ? (deptLegacyToNew.get(deptLegacy) ?? null) : null;
    const designationId =
      desigLegacy && desigLegacy !== '0' ? (desigLegacyToNew.get(desigLegacy) ?? null) : null;

    let employeeCode = e.emp_id!.trim();
    if (!employeeCode || usedEmployeeCodes.has(employeeCode)) {
      const original = employeeCode;
      employeeCode = `LEGACY-${legacyId}`;
      report.push(
        `id=${legacyId} ${e.fname} ${e.lname}: legacy emp_id ${original ? `"${original}" collided with another employee` : 'was blank'} — used "${employeeCode}" instead.`,
      );
    }
    usedEmployeeCodes.add(employeeCode);

    const employee = await prisma.employee.create({
      data: {
        userId,
        employeeCode,
        firstName: e.fname!.trim(),
        lastName: isNullish(e.lname) ? '' : e.lname!.trim(),
        personalEmail:
          personalEmailRaw && personalEmailRaw !== loginEmail ? personalEmailRaw : null,
        phone: isNullish(e.mobile1) ? null : e.mobile1!.trim(),
        dateOfBirth: parseDateOrNull(e.dob),
        dateOfJoining: doj,
        employmentType,
        workLocation: isNullish(e.work_location) ? null : e.work_location!.trim(),
        currentAddress: isNullish(e.current_address) ? null : e.current_address!.trim(),
        status,
        departmentId,
        designationId,
      },
    });
    legacyIdToNewEmployeeId.set(legacyId, employee.id);
    created++;
  }
  console.log(
    `Imported ${created} employees (${reusedAdminUser} linked to the existing preserved admin user).`,
  );

  // ---- second pass: manager links ----
  let managerLinks = 0;
  for (const [empLegacyId, info] of primaryManagerByEmp) {
    const empNewId = legacyIdToNewEmployeeId.get(empLegacyId);
    const mgrNewId = legacyIdToNewEmployeeId.get(info.managerLegacyId);
    if (empNewId && mgrNewId && empNewId !== mgrNewId) {
      await prisma.employee.update({ where: { id: empNewId }, data: { managerId: mgrNewId } });
      managerLinks++;
    }
  }
  console.log(`Set ${managerLinks} manager links.`);

  await prisma.$disconnect();

  const reportPath = dumpPath.replace(/\.sql$/, '') + '.import-report.txt';
  writeFileSync(reportPath, report.join('\n') + '\n', 'utf8');
  console.log(`\n${report.length} items need manual follow-up — written to ${reportPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
