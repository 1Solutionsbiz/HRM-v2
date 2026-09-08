// One-off: backfill Resignation rows for employees who left before this
// app's resignation workflow existed - imported as inactive Employee rows
// with dateOfExit (legacy data), never as a formal Resignation submission.
// submittedAt and lastWorkingDay both use dateOfExit since no earlier
// "requested on" date exists in the legacy data; noticePeriodDays is 0 for
// the same reason. Skips anyone who already has a Resignation row.
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client.js';

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL as string) });

  const departed = await prisma.employee.findMany({
    where: { status: 'INACTIVE', dateOfExit: { not: null } },
    select: { id: true, firstName: true, lastName: true, dateOfExit: true },
  });

  let created = 0;
  let skipped = 0;
  for (const emp of departed) {
    const existing = await prisma.resignation.findFirst({ where: { employeeId: emp.id } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.resignation.create({
      data: {
        employeeId: emp.id,
        reason: 'Migrated from legacy employee record (exit date on file).',
        submittedAt: emp.dateOfExit!,
        lastWorkingDay: emp.dateOfExit!,
        noticePeriodDays: 0,
        status: 'APPROVED',
        decidedAt: emp.dateOfExit!,
        decisionNote: 'Backfilled from legacy dateOfExit - no original decision record exists.',
      },
    });
    created++;
    console.log(`Created resignation for ${emp.firstName} ${emp.lastName} (exit ${emp.dateOfExit!.toISOString().slice(0, 10)})`);
  }

  console.log(`\nDone. Created ${created}, skipped ${skipped} (already had a resignation record).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
