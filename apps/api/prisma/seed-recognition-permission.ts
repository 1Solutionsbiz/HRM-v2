import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client.js';

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL as string) });

  const permission = await prisma.permission.upsert({
    where: { key: 'recognition:manage' },
    create: { key: 'recognition:manage', description: 'Nominate the employee of the month' },
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
    console.log(`Granted recognition:manage to role "${roleKey}".`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
