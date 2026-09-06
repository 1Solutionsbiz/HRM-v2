// One-off backfill: employee profile photos.
//
// Supersedes an earlier same-day version of this script that set
// `avatarUrl` to a hotlinked `https://hrmpulse.com/upload-image/<filename>`
// URL - a real dependency on the legacy host staying reachable, flagged in
// PROJECT_STATUS.md as a stopgap rather than a fix. This version instead
// reads `avatars-manifest.json` (produced by `apps/web/download-avatars.mjs`,
// which downloads each photo from hrmpulse.com, resizes it to a 256x256
// JPEG thumbnail via sharp, and saves it to `apps/web/public/avatars/
// <employeeCode>.jpg` - 35 photos, ~14KB average, 484KB total, checked into
// the web app's own `public/` folder so they deploy and persist exactly
// like any other static asset, with no dependency on hrmpulse.com and no
// new file-storage provider needed) and points `avatarUrl` at that
// same-origin path (`/avatars/<employeeCode>.jpg`) instead.
//
// Run: npx tsx --env-file=<path-to-hrm-api.env> prisma/backfill-employee-avatars.ts <path-to-avatars-manifest.json>
import { readFileSync } from 'node:fs';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client.js';

async function main() {
  const manifestPath = process.argv[2];
  if (!manifestPath) {
    console.error('usage: tsx backfill-employee-avatars.ts <path-to-avatars-manifest.json>');
    process.exit(1);
  }
  const manifest: Record<string, string> = JSON.parse(readFileSync(manifestPath, 'utf8'));

  const adapter = new PrismaMariaDb(process.env.DATABASE_URL as string);
  const prisma = new PrismaClient({ adapter });

  const employees = await prisma.employee.findMany({ select: { id: true, employeeCode: true } });
  const codeToId = new Map(employees.map((e) => [e.employeeCode, e.id]));

  let updated = 0;
  let skipped = 0;
  for (const [employeeCode, avatarPath] of Object.entries(manifest)) {
    const id = codeToId.get(employeeCode);
    if (!id) {
      console.log(`SKIPPED ${employeeCode}: no matching V2 employee.`);
      skipped++;
      continue;
    }
    await prisma.employee.update({ where: { id }, data: { avatarUrl: avatarPath } });
    updated++;
  }

  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
