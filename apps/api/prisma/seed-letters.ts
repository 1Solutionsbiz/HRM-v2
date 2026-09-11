// One-off: seed the Employee Letters module's fixed reference data directly
// into production - prisma/seed.ts is local-dev-only (see its own header),
// same pattern as seed-poll-permission.ts / seed-recognition-permission.ts.
// Idempotent throughout (every write is an upsert, or an existence check
// before create) - safe to re-run.
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { CATEGORIES, LETTER_TYPES, PERMISSIONS, SIGNATORY } from './letter-seed-data.js';

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL as string) });

  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      create: permission,
      update: {},
    });
    console.log('Permission:', permission.key);

    for (const roleKey of ['admin', 'hr']) {
      const role = await prisma.role.findUnique({ where: { key: roleKey } });
      if (!role) {
        console.log(`Role "${roleKey}" not found - skipping.`);
        continue;
      }
      const perm = await prisma.permission.findUniqueOrThrow({ where: { key: permission.key } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        create: { roleId: role.id, permissionId: perm.id },
        update: {},
      });
      console.log(`Granted ${permission.key} to role "${roleKey}".`);
    }
  }

  const categoryIdByKey = new Map<string, string>();
  for (const category of CATEGORIES) {
    const row = await prisma.letterCategory.upsert({
      where: { key: category.key },
      create: { key: category.key, name: category.name },
      update: { name: category.name },
    });
    categoryIdByKey.set(category.key, row.id);
    console.log('Letter category:', row.key);
  }

  let signatory = await prisma.letterSignatory.findFirst({ where: { isDefault: true } });
  if (!signatory) {
    signatory = await prisma.letterSignatory.create({
      data: { name: SIGNATORY.name, title: SIGNATORY.title, isDefault: true, isActive: true },
    });
    console.log('Created default signatory:', signatory.name, '/', signatory.title);
  } else {
    console.log('Default signatory already exists:', signatory.name, '/', signatory.title);
  }

  for (const letterType of LETTER_TYPES) {
    const categoryId = categoryIdByKey.get(letterType.categoryKey);
    if (!categoryId) throw new Error(`Unknown category "${letterType.categoryKey}"`);

    const type = await prisma.letterType.upsert({
      where: { key: letterType.key },
      create: {
        key: letterType.key,
        name: letterType.name,
        categoryId,
        numberPrefix: letterType.numberPrefix,
        isActive: true,
      },
      update: { name: letterType.name, categoryId, isActive: true },
    });
    console.log('Letter type:', type.key, `(${type.numberPrefix})`);

    let template = await prisma.letterTemplate.findFirst({ where: { letterTypeId: type.id } });
    if (!template) {
      template = await prisma.letterTemplate.create({
        data: {
          letterTypeId: type.id,
          name: `${letterType.name} - Standard`,
          isActive: true,
          signatoryId: signatory.id,
          currentVersionNumber: 0,
        },
      });
      console.log(`  Created template for ${type.key}.`);
    }

    // Ensure every declared version exists (append-only - this never edits
    // an existing version's content, see LetterTypeSeed's comment) and
    // promote to the latest. Idempotent: re-running with the same
    // `versions` array creates nothing new and leaves currentVersionNumber
    // untouched once it's already at the latest, so a repeat seed run is a
    // no-op for a type whose versions haven't changed.
    for (let i = 0; i < letterType.versions.length; i++) {
      const versionNumber = i + 1;
      const existing = await prisma.letterTemplateVersion.findUnique({
        where: { templateId_versionNumber: { templateId: template.id, versionNumber } },
      });
      if (!existing) {
        await prisma.letterTemplateVersion.create({
          data: { templateId: template.id, versionNumber, content: letterType.versions[i] },
        });
        console.log(`  Seeded version ${versionNumber} content for ${type.key}.`);
      }
    }

    const latestVersionNumber = letterType.versions.length;
    if (template.currentVersionNumber !== latestVersionNumber) {
      await prisma.letterTemplate.update({
        where: { id: template.id },
        data: { currentVersionNumber: latestVersionNumber, signatoryId: template.signatoryId ?? signatory.id },
      });
      console.log(`  Promoted ${type.key} to version ${latestVersionNumber}.`);
    } else {
      console.log(`  ${type.key} is already on version ${latestVersionNumber} - left unchanged.`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
