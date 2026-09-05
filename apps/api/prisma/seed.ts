import { randomBytes } from 'node:crypto';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PasswordService } from '../src/security/password.service.js';

/**
 * Local-dev bootstrap data only — never run against production (rule 3).
 * Idempotent: every write is an upsert (or an existence check for the admin
 * user), so re-running after a schema change is safe.
 */

const ROLES = [
  { key: 'employee', label: 'Employee' },
  { key: 'manager', label: 'Manager' },
  { key: 'hr', label: 'HR' },
  { key: 'admin', label: 'Admin' },
] as const;

/**
 * Only permissions an actual route enforces today via `@RequirePermissions()`
 * — as later modules add gated routes, add their keys here alongside them,
 * not speculatively ahead of time.
 */
const PERMISSIONS = [
  { key: 'user:manage', description: 'Create, deactivate, and assign roles to user accounts' },
  { key: 'employee:manage', description: 'Create and update employee HR profiles' },
  { key: 'attendance:manage', description: 'Record manual attendance corrections for any employee' },
  { key: 'leave:approve', description: 'Approve or reject any employee leave request' },
  { key: 'expense:approve', description: 'Approve or reject any employee expense claim' },
  { key: 'performance:manage', description: 'Assign goals, conduct reviews, and award recognitions for any employee' },
  { key: 'announcement:publish', description: 'Publish company-wide announcements' },
  { key: 'resignation:decide', description: 'Approve or decline any employee resignation' },
  { key: 'payroll:manage', description: 'View company-wide salary data, revise salaries, and generate payslips' },
  { key: 'company:manage', description: 'Edit company profile settings (legal name, brand, contact details)' },
] as const;

const ROLE_PERMISSIONS: Record<(typeof ROLES)[number]['key'], readonly string[]> = {
  admin: [
    'user:manage',
    'employee:manage',
    'attendance:manage',
    'leave:approve',
    'expense:approve',
    'performance:manage',
    'announcement:publish',
    'resignation:decide',
    'payroll:manage',
    'company:manage',
  ],
  hr: [
    'employee:manage',
    'attendance:manage',
    'leave:approve',
    'expense:approve',
    'performance:manage',
    'announcement:publish',
    'resignation:decide',
    'payroll:manage',
  ],
  // Manager approval isn't scoped to "my direct reports" yet (no reporting-
  // chain enforcement exists) — granted anyway since some approver has to
  // exist beyond hr/admin; documented gap in PROJECT_STATUS.md.
  manager: ['leave:approve', 'expense:approve', 'performance:manage'],
  employee: [],
};

/** Every SequenceCounter key a module relies on for atomic code generation — see SequenceService. */
const SEQUENCE_COUNTERS = ['employeeCode', 'leaveRequestCode', 'expenseClaimCode', 'payslipCode'] as const;

/** Matches the mock's `leaveBalances` fixture (Casual/Sick/Earned, with those day counts). */
const LEAVE_TYPES = [
  { key: 'casual', name: 'Casual Leave', defaultAnnualDays: 12 },
  { key: 'sick', name: 'Sick Leave', defaultAnnualDays: 6 },
  { key: 'earned', name: 'Earned Leave', defaultAnnualDays: 15 },
] as const;

/** Matches the mock's `documents` fixture. */
const DOCUMENT_TYPES = [
  { key: 'aadhaar', name: 'Aadhaar card', category: 'IDENTITY' },
  { key: 'pan', name: 'PAN card', category: 'IDENTITY' },
  { key: 'marksheet-10', name: '10th marksheet', category: 'EDUCATION' },
  { key: 'marksheet-12', name: '12th marksheet', category: 'EDUCATION' },
  { key: 'bank-proof', name: 'Bank passbook / cancelled cheque', category: 'BANKING' },
  { key: 'relieving-letter', name: 'Relieving letter (previous employer)', category: 'EMPLOYMENT' },
] as const;

/**
 * Matches the mock's `expenseCategories` fixture. `Internet & Phone` gets
 * the ₹5,000/mo cap the schema comment on `ExpenseCategory.monthlyCapAmount`
 * cites as its motivating case (a legacy hardcoded policy-doc rule, made an
 * actual enforced, editable value) — the other categories are uncapped.
 */
const EXPENSE_CATEGORIES = [
  { name: 'Travel', monthlyCapAmount: null },
  { name: 'Food', monthlyCapAmount: null },
  { name: 'Internet & Phone', monthlyCapAmount: 5000 },
  { name: 'Office Supplies', monthlyCapAmount: null },
  { name: 'Client Entertainment', monthlyCapAmount: null },
  { name: 'Other', monthlyCapAmount: null },
] as const;

/**
 * Matches the mock's `performance` fixture cycles ("H2 2026 Review Cycle",
 * ending 2026-12-15; "H1 2026", referenced by `lastReview.cycle`). The mock
 * gives no start date for either — half-year boundaries (Jan 1 / Jul 1) are
 * inferred, not confirmed.
 */
const PERFORMANCE_CYCLES = [
  { name: 'H1 2026', startDate: '2026-01-01', endDate: '2026-06-30', isActive: false },
  { name: 'H2 2026 Review Cycle', startDate: '2026-07-01', endDate: '2026-12-15', isActive: true },
] as const;

function randomPassword(): string {
  return randomBytes(18).toString('base64url');
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run the seed script');
  }

  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseUrl) });
  const passwordService = new PasswordService();

  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { key: role.key },
      create: role,
      update: { label: role.label },
    });
  }

  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      create: permission,
      update: { description: permission.description },
    });
  }

  for (const [roleKey, permissionKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.findUniqueOrThrow({ where: { key: roleKey } });
    for (const permissionKey of permissionKeys) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { key: permissionKey } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      });
    }
  }

  for (const key of SEQUENCE_COUNTERS) {
    await prisma.sequenceCounter.upsert({ where: { key }, create: { key, value: 0 }, update: {} });
  }

  // Matches apps/web/src/lib/mock/fixtures.ts's `officeTiming` (09:30/18:30,
  // 15min grace, 9h full day, 4.5h half-day threshold). `AttendancePolicy`
  // has no schema defaults for these fields — AttendanceService.getPolicyOrThrow
  // fails loudly rather than guessing if this row is missing.
  await prisma.attendancePolicy.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      standardStartTime: new Date(Date.UTC(1970, 0, 1, 9, 30, 0)),
      standardEndTime: new Date(Date.UTC(1970, 0, 1, 18, 30, 0)),
      graceMinutes: 15,
      halfDayThresholdHours: 4.5,
      fullDayHours: 9,
      workingWeekdays: [1, 2, 3, 4, 5],
    },
    update: {},
  });

  for (const leaveType of LEAVE_TYPES) {
    await prisma.leaveType.upsert({
      where: { key: leaveType.key },
      create: leaveType,
      update: { name: leaveType.name, defaultAnnualDays: leaveType.defaultAnnualDays },
    });
  }

  for (const documentType of DOCUMENT_TYPES) {
    await prisma.documentType.upsert({
      where: { key: documentType.key },
      create: documentType,
      update: { name: documentType.name, category: documentType.category },
    });
  }

  for (const category of EXPENSE_CATEGORIES) {
    await prisma.expenseCategory.upsert({
      where: { name: category.name },
      create: category,
      update: { monthlyCapAmount: category.monthlyCapAmount },
    });
  }

  for (const cycle of PERFORMANCE_CYCLES) {
    await prisma.performanceCycle.upsert({
      where: { name: cycle.name },
      create: cycle,
      update: { startDate: cycle.startDate, endDate: cycle.endDate, isActive: cycle.isActive },
    });
  }

  // Matches the mock's `companyProfile` fixture. AdminService fails loudly
  // rather than guessing if this row is missing, same stance as
  // AttendancePolicy's singleton.
  await prisma.companySettings.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      legalName: '1Solutions Pvt. Ltd.',
      brandName: '1Solutions',
      website: 'https://1solutions.biz',
      supportEmail: 'hr@1solutions.biz',
      phone: '+91 11 4567 8900',
      address: 'F Block, Laxmi Nagar, New Delhi, Delhi 110092',
      timezone: 'Asia/Kolkata',
    },
    update: {},
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@1solutions.biz';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (existingAdmin) {
    console.log(`Bootstrap admin ${adminEmail} already exists — skipped.`);
  } else {
    const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? randomPassword();
    const passwordHash = await passwordService.hash(adminPassword);
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { key: 'admin' } });

    const adminUser = await prisma.user.create({ data: { email: adminEmail, passwordHash } });
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: adminRole.id } });

    console.log('--- Seeded a bootstrap admin account (local dev only) ---');
    console.log(`  email:    ${adminEmail}`);
    console.log(`  password: ${adminPassword}`);
    console.log('Shown once, never stored in plaintext anywhere. Change it after first login.');
  }

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
