// One-off legacy-data import (Phase 2: holidays, education, bank details,
// emergency contacts, leave, expenses, salary, payslips). Parses the
// phpMyAdmin dump directly rather than executing it — same approach as
// import-legacy-spine.ts (Phase 1), which this depends on: it resolves
// legacy `hrm_employee.id` -> V2 Employee.id by reconstructing the same
// employeeCode assignment Phase 1 used (emp_id, or LEGACY-{id} on a
// collision/blank), then looking that code up in the already-imported
// Employee table.
//
// Idempotent per domain: each section deletes the rows it owns before
// re-inserting, so it can be re-run against a newer dump. It only ever
// reads Employee/Role/User, never re-creates the Phase 1 spine.
//
// Run: DATABASE_URL=... ENCRYPTION_KEY=... npx tsx prisma/import-legacy-phase2.ts <path-to-dump.sql>
import { readFileSync, writeFileSync } from 'node:fs';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { EncryptionService } from '../src/security/encryption.service.js';

const PRESERVED_ADMIN_EMAIL = 'atul@1solutions.biz';

// ---------------------------------------------------------------------------
// Backslash-aware SQL dump parser (mysqldump default escaping, NOT the
// doubled-quote SQL-standard form) — free-text fields (leave reasons,
// expense descriptions) contain literal `\'`, `\n`, etc.
// ---------------------------------------------------------------------------
type Row = Record<string, string>;

function extractInsertBlock(sql: string, table: string): { cols: string[]; body: string } | null {
  const headerRe = new RegExp(`INSERT INTO \`${table}\`\\s*\\(([^)]*)\\)\\s*VALUES\\s*\\n`);
  const headerMatch = headerRe.exec(sql);
  if (!headerMatch) return null;
  const cols = headerMatch[1]!.split(',').map((c) => c.trim().replace(/`/g, ''));
  let i = headerMatch.index + headerMatch[0].length;
  const n = sql.length;
  let inStr = false;
  while (i < n) {
    const c = sql[i];
    if (inStr) {
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === "'") inStr = false;
      i++;
      continue;
    }
    if (c === "'") {
      inStr = true;
      i++;
      continue;
    }
    if (c === ';' && sql[i - 1] === ')') {
      const body = sql.slice(headerMatch.index + headerMatch[0].length, i);
      return { cols, body };
    }
    i++;
  }
  return null;
}

function splitRows(body: string): string[] {
  const rows: string[] = [];
  let depth = 0;
  let inStr = false;
  let cur: string[] = [];
  const n = body.length;
  let i = 0;
  while (i < n) {
    const c = body[i]!;
    if (inStr) {
      cur.push(c);
      if (c === '\\' && i + 1 < n) {
        cur.push(body[i + 1]!);
        i += 2;
        continue;
      }
      if (c === "'") inStr = false;
      i++;
      continue;
    }
    if (c === "'") {
      inStr = true;
      cur.push(c);
      i++;
      continue;
    }
    if (c === '(') {
      if (depth === 0) cur = [];
      else cur.push(c);
      depth++;
      i++;
      continue;
    }
    if (c === ')') {
      depth--;
      if (depth === 0) rows.push(cur.join(''));
      else cur.push(c);
      i++;
      continue;
    }
    if (depth > 0) cur.push(c);
    i++;
  }
  return rows;
}

function parseSqlRow(row: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inStr = false;
  const n = row.length;
  let i = 0;
  const escapeMap: Record<string, string> = {
    n: '\n',
    r: '\r',
    t: '\t',
    '0': '\0',
    "'": "'",
    '"': '"',
    '\\': '\\',
  };
  while (i < n) {
    const c = row[i]!;
    if (inStr) {
      if (c === '\\' && i + 1 < n) {
        const next = row[i + 1]!;
        cur += escapeMap[next] ?? next;
        i += 2;
        continue;
      }
      if (c === "'") {
        inStr = false;
        i++;
        continue;
      }
      cur += c;
      i++;
      continue;
    }
    if (c === "'") {
      inStr = true;
      i++;
      continue;
    }
    if (c === ',') {
      out.push(cur);
      cur = '';
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseTable(sql: string, table: string): Row[] {
  const block = extractInsertBlock(sql, table);
  if (!block) return [];
  return splitRows(block.body).map((r) => {
    const values = parseSqlRow(r);
    const row: Row = {};
    block.cols.forEach((c, idx) => (row[c] = values[idx] ?? ''));
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
  if (t.startsWith('0000-00-00')) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function main() {
  const dumpPath = process.argv[2];
  if (!dumpPath) {
    console.error('usage: tsx import-legacy-phase2.ts <path-to-dump.sql>');
    process.exit(1);
  }
  const sql = readFileSync(dumpPath, 'utf8');
  const report: string[] = [];

  const adapter = new PrismaMariaDb(process.env.DATABASE_URL as string);
  const prisma = new PrismaClient({ adapter });
  const encryption = new EncryptionService({
    getOrThrow: (key: string) => process.env[key] as string,
  } as never);

  const preservedAdmin = await prisma.user.findFirstOrThrow({
    where: { email: PRESERVED_ADMIN_EMAIL },
  });

  // ---- rebuild legacy id -> V2 Employee.id (same rule Phase 1 used) ----
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
  const employees = await prisma.employee.findMany({ select: { id: true, employeeCode: true } });
  const codeToEmployeeId = new Map(employees.map((e) => [e.employeeCode, e.id]));
  const legacyIdToEmployeeId = new Map<string, string>();
  for (const [legacyId, code] of legacyIdToEmployeeCode) {
    const empId = codeToEmployeeId.get(code);
    if (empId) legacyIdToEmployeeId.set(legacyId, empId);
  }
  console.log(
    `Resolved ${legacyIdToEmployeeId.size}/${legacyEmployees.length} legacy employees to V2 records.`,
  );

  // ==================== Holidays ====================
  const legacyHolidays = parseTable(sql, 'hrm_holidays');
  await prisma.holiday.deleteMany({});
  let holidayCount = 0;
  for (const h of legacyHolidays) {
    const date = parseDateOrNull(h.date);
    if (!date) {
      report.push(`Holiday "${h.name}" (legacy id ${h.id}): invalid date, skipped.`);
      continue;
    }
    try {
      await prisma.holiday.create({ data: { name: h.name!.trim(), date } });
      holidayCount++;
    } catch {
      report.push(`Holiday "${h.name}" (legacy id ${h.id}): duplicate date, skipped.`);
    }
  }
  console.log(`Imported ${holidayCount}/${legacyHolidays.length} holidays.`);

  // ==================== Education ====================
  const legacyEducation = parseTable(sql, 'hrm_employee_education');
  await prisma.employeeEducation.deleteMany({});
  let eduCount = 0;
  for (const ed of legacyEducation) {
    const employeeId = legacyIdToEmployeeId.get(ed.emp_id!.trim());
    if (!employeeId) {
      report.push(
        `Education legacy id=${ed.id}: no matching employee for legacy emp_id=${ed.emp_id}, skipped.`,
      );
      continue;
    }
    const institution = !isNullish(ed.college_name)
      ? ed.college_name!.trim()
      : !isNullish(ed.university_name)
        ? ed.university_name!.trim()
        : 'Unknown institution';
    const fieldOfStudy =
      [ed.course_name, ed.stream]
        .filter((s) => !isNullish(s))
        .map((s) => s!.trim())
        .join(' - ') || null;
    await prisma.employeeEducation.create({
      data: {
        employeeId,
        institution,
        fieldOfStudy,
        startDate: parseDateOrNull(ed.start_date),
        endDate: parseDateOrNull(ed.end_date),
      },
    });
    eduCount++;
  }
  console.log(`Imported ${eduCount}/${legacyEducation.length} education records.`);

  // ==================== Bank details ====================
  const legacyBank = parseTable(sql, 'hrm_bank_detail');
  await prisma.employeeBankDetail.deleteMany({});
  let bankCount = 0;
  const seenBankEmployee = new Set<string>();
  for (const b of legacyBank) {
    const legacyEmpId = b.emp_id?.trim();
    if (!legacyEmpId || legacyEmpId === '0') {
      report.push(`Bank detail legacy id=${b.id}: invalid/missing emp_id, skipped.`);
      continue;
    }
    const employeeId = legacyIdToEmployeeId.get(legacyEmpId);
    if (!employeeId) {
      report.push(`Bank detail legacy id=${b.id}: no matching employee, skipped.`);
      continue;
    }
    if (seenBankEmployee.has(employeeId)) {
      report.push(
        `Bank detail legacy id=${b.id}: employee already has a bank record imported (V2 allows only one), skipped.`,
      );
      continue;
    }
    if (isNullish(b.account_number) || isNullish(b.bank_name)) {
      report.push(`Bank detail legacy id=${b.id}: missing bank name or account number, skipped.`);
      continue;
    }
    await prisma.employeeBankDetail.create({
      data: {
        employeeId,
        bankName: b.bank_name!.trim(),
        accountNumberEncrypted: encryption.encrypt(b.account_number!.trim()),
        ifscCode: !isNullish(b.ifsc) ? b.ifsc!.trim() : '',
        panNumberEncrypted: !isNullish(b.pan) ? encryption.encrypt(b.pan!.trim()) : null,
      },
    });
    seenBankEmployee.add(employeeId);
    bankCount++;
  }
  console.log(`Imported ${bankCount}/${legacyBank.length} bank details (encrypted).`);

  // ==================== Emergency contacts ====================
  // Sourced from hrm_employee_family, NOT hrm_employee_emergency_contact
  // (that table is empty/unused in the live app — confirmed by comparing
  // against what the legacy profile page actually renders).
  const legacyFamily = parseTable(sql, 'hrm_employee_family');
  const relationshipNames = parseTable(sql, 'hrm_family_relationship_member');
  const relById = new Map(relationshipNames.map((r) => [r.id!.trim(), r.name!.trim()]));
  await prisma.employeeEmergencyContact.deleteMany({});
  const familyByEmp = new Map<string, Row[]>();
  for (const f of legacyFamily) {
    const key = f.emp_id!.trim();
    if (!familyByEmp.has(key)) familyByEmp.set(key, []);
    familyByEmp.get(key)!.push(f);
  }
  let contactCount = 0;
  for (const [legacyEmpId, contacts] of familyByEmp) {
    const employeeId = legacyIdToEmployeeId.get(legacyEmpId);
    if (!employeeId) continue;
    const isPlaceholderName = (name: string) => /^\d+$/.test(name.trim()) || name.trim() === '';
    const best =
      contacts.find((c) => !isNullish(c.phone) && !isPlaceholderName(c.name!)) ??
      contacts.find((c) => !isNullish(c.phone)) ??
      contacts[0]!;
    await prisma.employeeEmergencyContact.create({
      data: {
        employeeId,
        name: !isPlaceholderName(best.name!) ? best.name!.trim() : 'Not on file',
        relationship: relById.get(best.relationship_id!.trim()) ?? 'Other',
        phone: !isNullish(best.phone) ? best.phone!.trim() : 'Not provided',
      },
    });
    contactCount++;
    if (contacts.length > 1) {
      report.push(
        `Employee legacy id=${legacyEmpId}: had ${contacts.length} emergency/family contacts in legacy ` +
          `(V2 supports only 1) — kept "${best.name}", dropped the rest.`,
      );
    }
  }
  console.log(
    `Imported ${contactCount} emergency contacts (from ${legacyFamily.length} legacy family rows).`,
  );

  // ==================== Leave ====================
  const legacyLeaveTypes = parseTable(sql, 'hrm_leave_type');
  await prisma.leaveRequest.deleteMany({});
  await prisma.leaveBalance.deleteMany({});
  await prisma.leaveType.deleteMany({});
  const leaveTypeIdMap = new Map<string, string>();
  for (const lt of legacyLeaveTypes) {
    const created = await prisma.leaveType.create({
      data: {
        key: slugify(lt.name!),
        name: lt.name!.trim(),
        defaultAnnualDays: Number(lt.number_of_leave!.trim()) || 0,
        isPaid: !lt.name!.toLowerCase().includes('loss of pay'),
      },
    });
    leaveTypeIdMap.set(lt.id!.trim(), created.id);
  }
  console.log(`Imported ${leaveTypeIdMap.size} leave types.`);

  const legacyLeaveApplied = parseTable(sql, 'hrm_leave_applied');
  let leaveReqCount = 0;
  const usedByKey = new Map<string, number>(); // employeeId|leaveTypeId|year -> approved days
  for (const la of legacyLeaveApplied) {
    const employeeId = legacyIdToEmployeeId.get(la.emp_id!.trim());
    const leaveTypeId = leaveTypeIdMap.get(la.leave_type_id!.trim());
    const startDate = parseDateOrNull(la.start_date);
    const endDate = parseDateOrNull(la.end_date);
    if (!employeeId || !leaveTypeId || !startDate || !endDate) {
      report.push(`Leave request legacy id=${la.id}: unresolved employee/type/dates, skipped.`);
      continue;
    }
    const statusNum = la.status!.trim();
    const status = statusNum === '2' ? 'APPROVED' : statusNum === '0' || statusNum === '1' ? 'PENDING' : 'REJECTED';
    const dayTypeNum = la.day_type!.trim();
    // day_type=3 is legacy's "Short Leave" special case — closest V2 fit is HALF_DAY.
    const dayType = dayTypeNum === '1' || dayTypeNum === '3' ? 'HALF_DAY' : 'FULL_DAY';
    const totalDays = Number(la.no_of_days!.trim()) || 0;
    await prisma.leaveRequest.create({
      data: {
        code: `LR-LEGACY-${la.id!.trim()}`,
        employeeId,
        leaveTypeId,
        startDate,
        endDate,
        dayType,
        halfDayPeriod: dayType === 'HALF_DAY' ? 'MORNING' : null,
        totalDays,
        reason: !isNullish(la.leave_reason) ? la.leave_reason! : 'No reason on file',
        status,
        submittedAt: parseDateOrNull(la.created_at) ?? startDate,
      },
    });
    leaveReqCount++;
    if (status === 'APPROVED') {
      const year = startDate.getUTCFullYear();
      const key = `${employeeId}|${leaveTypeId}|${year}`;
      usedByKey.set(key, (usedByKey.get(key) ?? 0) + totalDays);
    }
  }
  console.log(`Imported ${leaveReqCount}/${legacyLeaveApplied.length} leave requests.`);

  let balanceCount = 0;
  for (const [key, usedDays] of usedByKey) {
    const [employeeId, leaveTypeId, yearStr] = key.split('|') as [string, string, string];
    const year = Number(yearStr);
    const lt = legacyLeaveTypes.find((l) => leaveTypeIdMap.get(l.id!.trim()) === leaveTypeId);
    const allocated = lt ? Number(lt.number_of_leave!.trim()) || 0 : 0;
    await prisma.leaveBalance.upsert({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
      create: { employeeId, leaveTypeId, year, allocatedDays: allocated, usedDays },
      update: { usedDays },
    });
    balanceCount++;
  }
  console.log(`Computed ${balanceCount} leave balance rows from approved history.`);

  // ==================== Expenses ====================
  const legacyExpenseCategories = parseTable(sql, 'expense_categories');
  await prisma.expenseClaim.deleteMany({});
  await prisma.expenseCategory.deleteMany({});
  const expenseCategoryIdMap = new Map<string, string>();
  for (const c of legacyExpenseCategories) {
    const created = await prisma.expenseCategory.create({ data: { name: c.name!.trim() } });
    expenseCategoryIdMap.set(c.id!.trim(), created.id);
  }
  console.log(`Imported ${expenseCategoryIdMap.size} expense categories.`);

  const legacyExpenses = parseTable(sql, 'employee_expenses');
  const expenseStatusMap: Record<string, 'PENDING' | 'APPROVED' | 'REJECTED'> = {
    Pending: 'PENDING',
    Approved: 'APPROVED',
    Rejected: 'REJECTED',
  };
  let expenseCount = 0;
  for (const ex of legacyExpenses) {
    const employeeId = legacyIdToEmployeeId.get((ex.employee_id ?? '').trim());
    const categoryId = expenseCategoryIdMap.get((ex.category_id ?? '').trim());
    const expenseDate = parseDateOrNull(ex.expense_date);
    if (!employeeId || !categoryId || !expenseDate) {
      report.push(`Expense claim legacy id=${ex.id}: unresolved employee/category/date, skipped.`);
      continue;
    }
    await prisma.expenseClaim.create({
      data: {
        code: `EXP-LEGACY-${ex.id!.trim()}`,
        employeeId,
        categoryId,
        amount: Number(ex.amount!.trim()) || 0,
        expenseDate,
        description: !isNullish(ex.description) ? ex.description! : 'No description on file',
        status: expenseStatusMap[ex.status!.trim()] ?? 'PENDING',
        submittedAt: parseDateOrNull(ex.submitted_at) ?? expenseDate,
        decidedAt: parseDateOrNull(ex.approved_at),
      },
    });
    expenseCount++;
  }
  console.log(`Imported ${expenseCount}/${legacyExpenses.length} expense claims.`);

  // ==================== Salary ====================
  const legacySalary = parseTable(sql, 'salary_managment');
  await prisma.salaryRevision.deleteMany({});
  await prisma.salaryStructure.deleteMany({});
  const salaryByEmployee = new Map<string, Row[]>();
  for (const s of legacySalary) {
    const key = s.emp_id!.trim();
    if (!salaryByEmployee.has(key)) salaryByEmployee.set(key, []);
    salaryByEmployee.get(key)!.push(s);
  }
  let salaryStructureCount = 0;
  let salaryRevisionCount = 0;
  for (const [legacyEmpId, records] of salaryByEmployee) {
    const employeeId = legacyIdToEmployeeId.get(legacyEmpId);
    if (!employeeId) {
      report.push(`Salary history for legacy emp_id=${legacyEmpId}: no matching employee, skipped.`);
      continue;
    }
    const sorted = [...records].sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
    const current =
      sorted.find((r) => isNullish(r.end) || r.end!.trim() === '0000-00-00') ?? sorted[sorted.length - 1]!;
    await prisma.salaryStructure.create({
      data: {
        employeeId,
        currentAmount: Number(current.salary!.trim()) || 0,
        lastRevisedAt: parseDateOrNull(current.start),
      },
    });
    salaryStructureCount++;

    let prevAmount: number | null = null;
    for (const r of sorted) {
      const effectiveDate = parseDateOrNull(r.start) ?? new Date();
      const newAmount = Number(r.salary!.trim()) || 0;
      await prisma.salaryRevision.create({
        data: {
          employeeId,
          previousAmount: prevAmount,
          newAmount,
          effectiveDate,
          revisedByUserId: preservedAdmin.id,
          reason: 'Migrated from legacy HRM salary history',
        },
      });
      prevAmount = newAmount;
      salaryRevisionCount++;
    }
  }
  console.log(
    `Imported ${salaryStructureCount} salary structures, ${salaryRevisionCount} salary revisions.`,
  );

  // ==================== Payslips ====================
  const legacyPayslips = parseTable(sql, 'salary_slip_generate');
  await prisma.payslipLineItem.deleteMany({});
  await prisma.payslip.deleteMany({});
  let payslipCount = 0;
  const seenPayslipKey = new Set<string>();
  for (const p of legacyPayslips) {
    const employeeId = legacyIdToEmployeeId.get((p.emp_id ?? '').trim());
    if (!employeeId) {
      report.push(`Payslip legacy id=${p.id}: unresolved employee, skipped.`);
      continue;
    }
    const month = Number(p.month!.trim());
    const year = Number(p.year!.trim());
    if (!month || !year) {
      report.push(`Payslip legacy id=${p.id}: invalid month/year, skipped.`);
      continue;
    }
    const dedupeKey = `${employeeId}|${month}|${year}`;
    if (seenPayslipKey.has(dedupeKey)) {
      report.push(
        `Payslip legacy id=${p.id}: duplicate month/year for this employee (V2 allows one payslip ` +
          `per employee per period), skipped.`,
      );
      continue;
    }
    seenPayslipKey.add(dedupeKey);

    const gross = Number(p.salary!.trim()) || 0;
    const net = Number(p.new_salary!.trim()) || 0;
    const payslip = await prisma.payslip.create({
      data: {
        payslipNumber: `PS-LEGACY-${p.id!.trim()}`,
        employeeId,
        periodMonth: month,
        periodYear: year,
        grossAmount: gross,
        netAmount: net,
        status: 'PAID',
        generatedAt: parseDateOrNull(p.created_at) ?? new Date(),
      },
    });

    // Matches salary_template.php's exact formula — the legacy PDF never
    // stored this breakup, it computed it at render time from the single
    // `salary` figure. Reproduced verbatim (not re-derived) so an imported
    // payslip's earnings block matches a legacy-issued PDF exactly:
    //   basic = salary * 0.4; hra = basic * 0.5;
    //   medical = 800 (flat); conveyance = 1200 (flat);
    //   specialAllowance = salary - (basic + medical + hra + conveyance)
    const basic = gross * 0.4;
    const hra = basic * 0.5;
    const medical = 800;
    const conveyance = 1200;
    const specialAllowance = gross - (basic + medical + hra + conveyance);
    const leaveDeduction = Number(p.leave_deduction?.trim() || '0');
    const lateDeduction = Number(p.late_deduction?.trim() || '0');

    const lineItems: { type: 'EARNING' | 'DEDUCTION'; label: string; amount: number; sortOrder: number }[] = [
      { type: 'EARNING', label: 'Basic', amount: basic, sortOrder: 0 },
      { type: 'EARNING', label: 'HRA', amount: hra, sortOrder: 1 },
      { type: 'EARNING', label: 'Medical', amount: medical, sortOrder: 2 },
      { type: 'EARNING', label: 'Conveyance', amount: conveyance, sortOrder: 3 },
      { type: 'EARNING', label: 'Special Allowance', amount: specialAllowance, sortOrder: 4 },
      // Always present, even at ₹0 — the legacy template renders both rows
      // unconditionally, so an imported payslip's Deduction column matches
      // a legacy PDF row-for-row.
      { type: 'DEDUCTION', label: 'Leave Deduction', amount: leaveDeduction, sortOrder: 0 },
      { type: 'DEDUCTION', label: 'Late Deduction', amount: lateDeduction, sortOrder: 1 },
    ];
    for (const li of lineItems) {
      await prisma.payslipLineItem.create({ data: { payslipId: payslip.id, ...li } });
    }
    payslipCount++;
  }
  console.log(`Imported ${payslipCount}/${legacyPayslips.length} payslips.`);

  await prisma.$disconnect();

  const reportPath = dumpPath.replace(/\.sql$/, '') + '.phase2-import-report.txt';
  writeFileSync(reportPath, report.join('\n') + '\n', 'utf8');
  console.log(`\n${report.length} items need manual follow-up — written to ${reportPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
