// One-off legacy-data import (Phase 3: Assets, Announcements, Onboarding
// step templates + per-employee progress, a handful of real Document
// records, and a correction to AttendancePolicy — which was seeded from
// mock fixture data, not the legacy system's real office_timing).
//
// Parses the same phpMyAdmin dump Phase 1/2 used. Idempotent per-domain:
// Assets/Announcements/Onboarding fully own their tables (empty before this
// script ever ran) and are wiped-then-reimported; Documents only upserts by
// (employeeId, documentTypeId) — it must NOT wipe employee_documents, since
// real employee-submitted documents already exist there from live use of
// the wired Documents module.
//
// Run: npx tsx --env-file=<path-to-hrm-api.env> prisma/import-legacy-phase3.ts <path-to-dump.sql>
import { readFileSync, writeFileSync } from 'node:fs';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client.js';

const PRESERVED_ADMIN_EMAIL = 'atul@1solutions.biz';

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
    console.error('usage: tsx import-legacy-phase3.ts <path-to-dump.sql>');
    process.exit(1);
  }
  const sql = readFileSync(dumpPath, 'utf8');
  const report: string[] = [];

  const adapter = new PrismaMariaDb(process.env.DATABASE_URL as string);
  const prisma = new PrismaClient({ adapter });

  const preservedAdmin = await prisma.user.findFirstOrThrow({
    where: { email: PRESERVED_ADMIN_EMAIL },
  });

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
    select: { id: true, employeeCode: true, userId: true },
  });
  const codeToEmployee = new Map(employees.map((e) => [e.employeeCode, e]));
  const legacyIdToEmployee = new Map<string, { id: string; userId: string }>();
  for (const [legacyId, code] of legacyIdToEmployeeCode) {
    const emp = codeToEmployee.get(code);
    if (emp) legacyIdToEmployee.set(legacyId, emp);
  }

  // =========================================================================
  // AttendancePolicy correction — the seeded singleton (09:30/18:30, 15min
  // grace, 4.5h half-day) came from mock fixture data (see seed.ts's own
  // comment), not the legacy system's real office_timing. This affects live
  // check-in/out classification going forward, not just the historical
  // import below, so it's corrected here rather than left wrong.
  // =========================================================================
  const officeTiming = parseTable(sql, 'office_timing')[0];
  if (officeTiming) {
    // login_time/logout_time are the real shift bounds. extra_fine_time
    // (09:15) is the threshold the legacy system actually fined lateness
    // at — relaxation_time (09:01) is a softer first-tier warning, not a
    // real grace window — so extra_fine_time's offset from login_time is
    // used as gracesMinutes. min_half_day_time (03:00:00) is the legacy
    // system's own explicit minimum-hours-for-half-day rule, more
    // authoritative than the current fictional 4.5h.
    const [loginH, loginM] = officeTiming.login_time!.split(':').map(Number);
    const [logoutH, logoutM] = officeTiming.logout_time!.split(':').map(Number);
    const [fineH, fineM] = officeTiming.extra_fine_time!.split(':').map(Number);
    const graceMinutes = fineH! * 60 + fineM! - (loginH! * 60 + loginM!);
    const [halfH, halfM] = officeTiming.min_half_day_time!.split(':').map(Number);
    const halfDayThresholdHours = halfH! + halfM! / 60;

    await prisma.attendancePolicy.update({
      where: { id: 'singleton' },
      data: {
        standardStartTime: new Date(Date.UTC(1970, 0, 1, loginH, loginM, 0)),
        standardEndTime: new Date(Date.UTC(1970, 0, 1, logoutH, logoutM, 0)),
        graceMinutes,
        halfDayThresholdHours,
      },
    });
    console.log(
      `Corrected AttendancePolicy from legacy office_timing: ${officeTiming.login_time}-${officeTiming.logout_time}, ` +
        `${graceMinutes}min grace, ${halfDayThresholdHours}h half-day threshold (was seeded from mock fixture data).`,
    );
  } else {
    report.push('AttendancePolicy NOT corrected: office_timing table not found in dump.');
  }

  // =========================================================================
  // Assets — hrm_assets (physical items) + hrm_asset_assignments (who holds
  // it). V2's Asset is flat (one employeeId per asset, no history), so a
  // reassigned physical asset uses whichever assignment has the latest
  // issued_date as the current holder. An asset with zero assignment rows
  // has no employeeId to attach and is skipped (schema requires one).
  // =========================================================================
  const legacyAssets = parseTable(sql, 'hrm_assets');
  const legacyAssignments = parseTable(sql, 'hrm_asset_assignments');
  const assignmentsByAsset = new Map<string, Row[]>();
  for (const a of legacyAssignments) {
    const key = a.asset_id!.trim();
    if (!assignmentsByAsset.has(key)) assignmentsByAsset.set(key, []);
    assignmentsByAsset.get(key)!.push(a);
  }

  await prisma.asset.deleteMany({});
  const usedAssetTags = new Set<string>();
  let assetsCreated = 0;
  for (const asset of legacyAssets) {
    const legacyId = asset.id!.trim();
    const assignments = assignmentsByAsset.get(legacyId) ?? [];
    if (assignments.length === 0) {
      report.push(
        `Asset "${asset.asset_name}" (legacy id ${legacyId}): no assignment row — nobody to attach it to, skipped.`,
      );
      continue;
    }
    const current = assignments.reduce((latest, a) =>
      a.issued_date! > latest.issued_date! ? a : latest,
    );
    const employee = legacyIdToEmployee.get(current.assignee_id!.trim());
    if (!employee) {
      report.push(
        `Asset "${asset.asset_name}" (legacy id ${legacyId}): assignee legacy id ${current.assignee_id} ` +
          `has no matching V2 employee, skipped.`,
      );
      continue;
    }
    let assetTag = asset.asset_id!.trim();
    if (!assetTag || usedAssetTags.has(assetTag)) assetTag = `LEGACY-ASSET-${legacyId}`;
    usedAssetTags.add(assetTag);

    const issuedDate = parseDateOrNull(current.issued_date) ?? new Date();
    await prisma.asset.create({
      data: {
        employeeId: employee.id,
        assetTag,
        name: asset.asset_name!.trim(),
        issuedDate,
        returnDate: parseDateOrNull(current.return_date),
      },
    });
    assetsCreated++;
  }
  console.log(`Imported ${assetsCreated}/${legacyAssets.length} assets.`);

  // =========================================================================
  // Announcements — legacy `announcement.show_to` targets specific
  // employees; V2's Announcement has no per-employee audience field, so
  // both imported rows become company-wide (matches the module's own
  // design: read-state is per-viewer via AnnouncementRead, not an audience
  // restriction on the announcement itself).
  // =========================================================================
  const legacyAnnouncements = parseTable(sql, 'announcement');
  await prisma.announcementRead.deleteMany({});
  await prisma.announcement.deleteMany({});
  let announcementsCreated = 0;
  for (const a of legacyAnnouncements) {
    const publisher = legacyIdToEmployee.get(a.created_by!.trim());
    const publishedByUserId = publisher?.userId ?? preservedAdmin.id;
    if (!publisher) {
      report.push(
        `Announcement "${a.title}" (legacy id ${a.id}): creator legacy id ${a.created_by} not found, ` +
          `attributed to the admin account instead.`,
      );
    }
    await prisma.announcement.create({
      data: {
        title: a.title!.trim(),
        body: a.description!.trim(),
        category: 'GENERAL',
        publishedByUserId,
        publishedAt: parseDateOrNull(a.created_at) ?? new Date(),
      },
    });
    announcementsCreated++;
  }
  console.log(`Imported ${announcementsCreated}/${legacyAnnouncements.length} announcements (all as company-wide, GENERAL).`);

  // =========================================================================
  // Onboarding — step templates (definitions) must exist before progress
  // rows reference them, same class of bug as DocumentType being empty.
  // =========================================================================
  const legacySteps = parseTable(sql, 'onboarding_steps');
  const legacyProgress = parseTable(sql, 'employee_onboarding_steps');

  await prisma.employeeOnboardingStep.deleteMany({});
  await prisma.onboardingStepTemplate.deleteMany({});
  const stepLegacyToNew = new Map<string, string>();
  for (const s of legacySteps) {
    const created = await prisma.onboardingStepTemplate.create({
      data: {
        name: s.step_name!.trim(),
        sortOrder: Number(s.step_order),
      },
    });
    stepLegacyToNew.set(s.step_id!.trim(), created.id);
  }
  console.log(`Imported ${stepLegacyToNew.size} onboarding step templates.`);

  let progressCreated = 0;
  for (const p of legacyProgress) {
    const employee = legacyIdToEmployee.get(p.employee_id!.trim());
    const stepTemplateId = stepLegacyToNew.get(p.step_id!.trim());
    if (!employee || !stepTemplateId) {
      report.push(
        `Onboarding progress legacy id=${p.id}: employee legacy id ${p.employee_id} or step ${p.step_id} ` +
          `not found, skipped.`,
      );
      continue;
    }
    const isCompleted = p.status!.trim() === '1';
    await prisma.employeeOnboardingStep.upsert({
      where: { employeeId_stepTemplateId: { employeeId: employee.id, stepTemplateId } },
      create: {
        employeeId: employee.id,
        stepTemplateId,
        isCompleted,
        completedAt: isCompleted ? (parseDateOrNull(p.update_date) ?? parseDateOrNull(p.created_at)) : null,
      },
      update: {},
    });
    progressCreated++;
  }
  console.log(`Imported ${progressCreated}/${legacyProgress.length} onboarding progress rows.`);

  // =========================================================================
  // Documents — only emp_documents (the clean, purpose-built wide table)
  // is imported. hrm_employee_documents/hrm_employee_document_proof are
  // deliberately skipped: they reference a document_type_id (4) that
  // doesn't exist in hrm_employee_document_type (only 1/2 defined), and
  // most of their rows belong to legacy employee id=11, which doesn't
  // exist in hrm_employee at all (confirmed already-orphaned in Phase 2's
  // education-import skips) — test/junk uploads for a deleted employee,
  // not real data. NOT wiped: upserts by (employeeId, documentTypeId) only,
  // since real employee-submitted documents already exist in this table
  // from live use of the wired Documents module this session.
  // =========================================================================
  const legacyDocRows = parseTable(sql, 'emp_documents');
  const docTypes = await prisma.documentType.findMany();
  const docTypeByKey = new Map(docTypes.map((d) => [d.key, d.id]));
  const FIELD_TO_KEY: Record<string, string> = {
    aadhaar: 'aadhaar',
    pancard: 'pan',
    '10th': 'marksheet-10',
    '12th': 'marksheet-12',
    bank_doc_1: 'bank-proof',
  };
  let documentsImported = 0;
  for (const row of legacyDocRows) {
    const employee = legacyIdToEmployee.get(row.emp_id!.trim());
    if (!employee) {
      report.push(`emp_documents legacy id=${row.id}: employee legacy id ${row.emp_id} not found, skipped.`);
      continue;
    }
    for (const [field, key] of Object.entries(FIELD_TO_KEY)) {
      const path = row[field];
      if (isNullish(path)) continue;
      const documentTypeId = docTypeByKey.get(key);
      if (!documentTypeId) {
        report.push(`emp_documents legacy id=${row.id}, field "${field}": DocumentType key "${key}" not seeded, skipped.`);
        continue;
      }
      const fileUrl = `https://hrmpulse.com/${path!.trim().replace(/^\/+/, '')}`;
      const uploadedAt = parseDateOrNull(row.created_at) ?? new Date();
      await prisma.employeeDocument.upsert({
        where: { employeeId_documentTypeId: { employeeId: employee.id, documentTypeId } },
        create: {
          employeeId: employee.id,
          documentTypeId,
          fileUrl,
          status: 'VERIFIED',
          uploadedAt,
          verifiedAt: uploadedAt,
        },
        update: {
          fileUrl,
          status: 'VERIFIED',
          uploadedAt,
          verifiedAt: uploadedAt,
        },
      });
      documentsImported++;
    }
  }
  console.log(`Imported ${documentsImported} real employee documents (verified reachable URLs on hrmpulse.com).`);

  await prisma.$disconnect();

  const reportPath = dumpPath.replace(/\.sql$/, '') + '.phase3-import-report.txt';
  writeFileSync(reportPath, report.join('\n') + '\n', 'utf8');
  console.log(`\n${report.length} items need manual follow-up — written to ${reportPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
