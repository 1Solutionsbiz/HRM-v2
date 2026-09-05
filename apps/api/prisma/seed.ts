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
] as const;

const ROLE_PERMISSIONS: Record<(typeof ROLES)[number]['key'], readonly string[]> = {
  admin: ['user:manage', 'employee:manage'],
  hr: ['employee:manage'],
  manager: [],
  employee: [],
};

/** Every SequenceCounter key a module relies on for atomic code generation — see SequenceService. */
const SEQUENCE_COUNTERS = ['employeeCode'] as const;

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
