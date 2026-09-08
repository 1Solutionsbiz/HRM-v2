// One-off: seed the new poll:manage permission directly into production -
// prisma/seed.ts is local-dev-only (see its own header), same pattern as
// the earlier ticket:manage seed. Idempotent (upserts).
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client.js';

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL as string) });

  const permission = await prisma.permission.upsert({
    where: { key: 'poll:manage' },
    create: { key: 'poll:manage', description: 'Create company-wide polls' },
    update: {},
  });
  console.log('Permission:', permission.key);

  for (const roleKey of ['admin', 'hr']) {
    const role = await prisma.role.findUnique({ where: { key: roleKey } });
    if (!role) {
      console.log(`Role "${roleKey}" not found - skipping.`);
      continue;
    }
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      create: { roleId: role.id, permissionId: permission.id },
      update: {},
    });
    console.log(`Granted poll:manage to role "${roleKey}".`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
