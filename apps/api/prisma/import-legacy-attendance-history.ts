// One-off legacy-data import: historical attendance from `newuser_attendance`.
// Queued since Phase 3 - see PROJECT_STATUS.md's "Deliberately still not
// imported" note - and safe to run unlike `hrm_attandance_machine_detail`
// (which identifies employees by ambiguous first-name strings, not id, and
// needs manual disambiguation first).
//
// Parses the same phpMyAdmin dump used by every prior phase. Idempotent:
// each (employeeId, date) this script would produce is deleted and
// recreated on every run (AttendanceDay's onDelete: Cascade takes its
// AttendanceEvent children with it), so it can be safely re-run - EXCEPT
// where a day already has a real, non-legacy-sourced event on it (see
// "Don't clobber live data" below), which is deliberately left alone even
// on a re-run.
//
// Timezone note: `clock_in_time`/`clock_out_time` are naive
// "YYYY-MM-DD HH:MM:SS" strings recorded by the legacy PHP app running on
// an IST host - they are IST wall-clock times, not UTC and not this
// script's host-local time. Parsed manually via `istToUtc()` below rather
// than `new Date(str)`, which would silently adopt whatever timezone this
// script happens to run in (see AttendanceService's own module comment on
// why the live app can get away with host-local Date getters and why a
// one-off script run from an arbitrary machine cannot).
//
// Status/lateMinutes/workedMinutes are computed with the exact same
// formula as AttendanceService.recomputeDay() (not trusted from legacy's
// own `status`/`late_status` labels), so imported days classify identically
// to a live check-in under today's AttendancePolicy.
//
// 2026-09-09 re-run against a fresh, much larger dump (5,542 rows vs the
// original 238, now spanning through 2026-09-08) surfaced two new hazards
// the original 238-row slice didn't have:
//
// 1. Fabricated `status='absent'` rows. 245 rows carry status='absent'; a
//    `clock_in_time`-vs-`created_at` gap check (real punches are created
//    within 0-2 days of their own date 99.3% of the time - 5,259/5,296)
//    shows 214 of the 245 were bulk-inserted long after the date they claim
//    (one employee, legacy user_id 1, has "absent" rows for literally every
//    weekday from 2012-05-01 through 2025, all with `created_at` on a single
//    day in 2025-04 and an empty `clock_in_ip` - a synthetic calendar
//    backfill, not real attendance). Confirmed this isn't a real signal
//    worth partially trusting: even the 31 small-gap 'absent' rows are from
//    the same contaminated batch and status field, so status='absent' is
//    skipped outright rather than kept/discarded row-by-row.
// 2. Don't clobber live data. The live V2 app has been recording real
//    check-ins since 2026-09-05 (AttendanceEvent.source='WEB'), and this
//    dump's dates now run right up to 2026-09-08 - overlapping the live
//    window. Blindly deleting+recreating every (employeeId, date) this
//    script touches would silently overwrite a real employee-entered check-
//    in with stale legacy data for the same day. Before writing a day, this
//    script now checks for any existing AttendanceEvent on it whose source
//    isn't BIOMETRIC_IMPORT, and skips (not overwrites) if one exists.
//
// Run: npx tsx --env-file=<path-to-hrm-api.env> prisma/import-legacy-attendance-history.ts <path-to-dump.sql>
import { readFileSync, writeFileSync } from 'node:fs';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client.js';

type Row = Record<string, string>;

/**
 * A large table's dump is split across multiple `INSERT INTO ... VALUES
 * (...), (...);` statements by phpMyAdmin (chunked, not one per table) -
 * this dump's `newuser_attendance` alone is 26 separate statements. Collects
 * every one and concatenates their row bodies, rather than the single
 * `.exec()` this used to be, which silently returned only the first chunk
 * (238 of 5,542 rows) with no error - see the 2026-09-09 file-header note.
 */
function extractInsertBlocks(sql: string, table: string): { cols: string[]; bodies: string[] } | null {
  const re = new RegExp(
    `INSERT INTO \`${table}\`\\s*\\(([^)]*)\\)\\s*VALUES\\s*\\n([\\s\\S]*?);\\n`,
    'g',
  );
  let cols: string[] | null = null;
  const bodies: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    cols ??= m[1]!.split(',').map((c) => c.trim().replace(/`/g, ''));
    bodies.push(m[2]!);
  }
  if (!cols) return null;
  return { cols, bodies };
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
  const block = extractInsertBlocks(sql, table);
  if (!block) return [];
  const out: Row[] = [];
  for (const rawBody of block.bodies) {
    let body = rawBody.trim();
    if (body.startsWith('(')) body = body.slice(1);
    if (body.endsWith(')')) body = body.slice(0, -1);
    for (const r of body.split('),\n(')) {
      const values = parseSqlRow(r);
      const row: Row = {};
      block.cols.forEach((c, i) => (row[c] = values[i] ?? ''));
      out.push(row);
    }
  }
  return out;
}

function isNullish(v: string | undefined): boolean {
  if (v === undefined) return true;
  const t = v.trim();
  return t === '' || t.toUpperCase() === 'NULL';
}

/** "YYYY-MM-DD HH:MM:SS" IST wall-clock -> {y,m,d,h,mi,s} + the true UTC instant. */
function parseIst(v: string): { y: number; mo: number; d: number; h: number; mi: number; s: number; utc: Date } {
  const [datePart, timePart] = v.split(' ');
  const [y, mo, d] = datePart!.split('-').map(Number);
  const [h, mi, s] = (timePart ?? '00:00:00').split(':').map(Number);
  // IST is UTC+5:30 - subtract that offset to get the true UTC instant.
  const utc = new Date(Date.UTC(y!, mo! - 1, d!, h! - 5, mi! - 30, s ?? 0));
  return { y: y!, mo: mo!, d: d!, h: h!, mi: mi!, s: s ?? 0, utc };
}

async function main() {
  const dumpPath = process.argv[2];
  if (!dumpPath) {
    console.error('usage: tsx import-legacy-attendance-history.ts <path-to-dump.sql>');
    process.exit(1);
  }
  const sql = readFileSync(dumpPath, 'utf8');
  const report: string[] = [];

  const adapter = new PrismaMariaDb(process.env.DATABASE_URL as string);
  const prisma = new PrismaClient({ adapter });

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
    select: { id: true, employeeCode: true, firstName: true, lastName: true },
  });
  const codeToEmployee = new Map(employees.map((e) => [e.employeeCode, e]));
  const legacyIdToEmployee = new Map<string, { id: string; firstName: string; lastName: string }>();
  for (const [legacyId, code] of legacyIdToEmployeeCode) {
    const emp = codeToEmployee.get(code);
    if (emp) legacyIdToEmployee.set(legacyId, emp);
  }

  const policy = await prisma.attendancePolicy.findUniqueOrThrow({ where: { id: 'singleton' } });
  const halfDayThresholdHours = Number(policy.halfDayThresholdHours);
  const standardMinutesOfDay =
    policy.standardStartTime.getUTCHours() * 60 + policy.standardStartTime.getUTCMinutes();

  const rows = parseTable(sql, 'newuser_attendance');
  report.push(`Source rows: ${rows.length}`);
  report.push(
    `Policy in effect: standardStart ${policy.standardStartTime.toISOString().slice(11, 16)} UTC-of-day, ` +
      `grace ${policy.graceMinutes}min, halfDayThreshold ${halfDayThresholdHours}h`,
  );

  let imported = 0;
  let skippedNoEmployee = 0;
  let skippedFabricated = 0;
  let skippedLiveDataExists = 0;
  const perEmployeeCount = new Map<string, number>();

  for (const r of rows) {
    const legacyEmployeeId = r.user_id!.trim();
    const employee = legacyIdToEmployee.get(legacyEmployeeId);
    if (!employee) {
      skippedNoEmployee++;
      report.push(`SKIPPED row id=${r.id}: legacy user_id ${legacyEmployeeId} has no matching V2 employee.`);
      continue;
    }
    if (isNullish(r.clock_in_time)) {
      report.push(`SKIPPED row id=${r.id} (${employee.firstName} ${employee.lastName}): no clock_in_time.`);
      continue;
    }
    // See the file-header note: status='absent' in this dump is a
    // fabricated bulk calendar-backfill, not a real attendance record.
    if (r.status?.trim() === 'absent') {
      skippedFabricated++;
      continue;
    }
    // The same backfill batches also produced a handful of non-'absent'
    // rows (a batch's last day was sometimes tagged 'logout'/'present'
    // instead) - real punches are created within 0-2 days of their own
    // date 99%+ of the time, so a >30-day gap between clock_in_time and
    // created_at is treated as the same fabrication, not a late manual
    // entry. Confirmed by hand: every row this catches has a created_at
    // matching one of the known mass-backfill event dates (2025-03-31,
    // 2025-04-07, 2025-04-09).
    if (!isNullish(r.created_at)) {
      const clockInDay = parseIst(r.clock_in_time!);
      const createdDay = parseIst(r.created_at!);
      const gapDays = Math.abs(
        (Date.UTC(createdDay.y, createdDay.mo - 1, createdDay.d) -
          Date.UTC(clockInDay.y, clockInDay.mo - 1, clockInDay.d)) /
          86_400_000,
      );
      if (gapDays > 30) {
        skippedFabricated++;
        report.push(
          `SKIPPED row id=${r.id} (${employee.firstName} ${employee.lastName}): ` +
            `created_at is ${gapDays} days from clock_in_time's own date - fabricated backfill, not a real punch.`,
        );
        continue;
      }
    }

    const checkIn = parseIst(r.clock_in_time!);
    let checkOut = isNullish(r.clock_out_time) ? null : parseIst(r.clock_out_time!);
    // 19 of 238 rows have a clock_out_time at or before clock_in_time (most
    // are exactly "06:00:00" same-date - a legacy sentinel/placeholder for
    // "never checked out," not a real punch). Treating the timestamp at
    // face value would produce a negative worked-duration clamped to 0 and
    // an inflated lateMinutes computed off a bogus late check-in read as
    // if it were real - worse than just admitting there's no real checkout,
    // which is what a live "forgot to check out" day looks like anyway.
    if (checkOut && checkOut.utc.getTime() <= checkIn.utc.getTime()) {
      report.push(
        `NOTE row id=${r.id} (${employee.firstName} ${employee.lastName}): ` +
          `clock_out_time "${r.clock_out_time}" is at/before clock_in_time "${r.clock_in_time}" - ` +
          `treated as no real checkout (legacy placeholder), not a negative shift.`,
      );
      checkOut = null;
    }
    const date = new Date(Date.UTC(checkIn.y, checkIn.mo - 1, checkIn.d));

    const checkInMinutesOfDay = checkIn.h * 60 + checkIn.mi;
    const lateMinutes = Math.max(0, checkInMinutesOfDay - standardMinutesOfDay - policy.graceMinutes);

    let workedMinutes: number | null = null;
    if (checkOut) {
      workedMinutes = Math.max(0, Math.round((checkOut.utc.getTime() - checkIn.utc.getTime()) / 60_000));
    }

    let status: 'PRESENT' | 'LATE' | 'HALF_DAY' = 'PRESENT';
    if (checkOut && workedMinutes != null) {
      const hours = workedMinutes / 60;
      status = hours < halfDayThresholdHours ? 'HALF_DAY' : lateMinutes > 0 ? 'LATE' : 'PRESENT';
    } else {
      status = lateMinutes > 0 ? 'LATE' : 'PRESENT';
    }

    // Don't clobber live data: if this (employee, date) already has a real,
    // non-legacy-sourced event on it (the live app has been recording real
    // check-ins since 2026-09-05), leave it alone rather than overwriting a
    // genuine employee-entered day with stale legacy data.
    const liveEvent = await prisma.attendanceEvent.findFirst({
      where: {
        employeeId: employee.id,
        source: { not: 'BIOMETRIC_IMPORT' },
        attendanceDay: { date },
      },
      select: { id: true },
    });
    if (liveEvent) {
      skippedLiveDataExists++;
      report.push(
        `SKIPPED row id=${r.id} (${employee.firstName} ${employee.lastName}, ${date.toISOString().slice(0, 10)}): ` +
          `a real (non-import) event already exists for this day - not overwriting live data.`,
      );
      continue;
    }

    // Idempotent: wipe any prior import of this exact (employee, date) —
    // AttendanceEvent cascades on AttendanceDay delete.
    await prisma.attendanceDay.deleteMany({ where: { employeeId: employee.id, date } });

    const day = await prisma.attendanceDay.create({
      data: {
        employeeId: employee.id,
        date,
        status,
        firstCheckInAt: checkIn.utc,
        lastCheckOutAt: checkOut?.utc ?? null,
        workedMinutes,
        lateMinutes,
        notes: 'Imported from legacy newuser_attendance',
      },
    });

    await prisma.attendanceEvent.create({
      data: {
        attendanceDayId: day.id,
        employeeId: employee.id,
        type: 'CHECK_IN',
        occurredAt: checkIn.utc,
        source: 'BIOMETRIC_IMPORT',
        note: `Legacy newuser_attendance row ${r.id}`,
      },
    });
    if (checkOut) {
      await prisma.attendanceEvent.create({
        data: {
          attendanceDayId: day.id,
          employeeId: employee.id,
          type: 'CHECK_OUT',
          occurredAt: checkOut.utc,
          source: 'BIOMETRIC_IMPORT',
          note: `Legacy newuser_attendance row ${r.id}`,
        },
      });
    }

    imported++;
    const key = `${employee.firstName} ${employee.lastName}`;
    perEmployeeCount.set(key, (perEmployeeCount.get(key) ?? 0) + 1);
  }

  report.push(`Imported: ${imported}`);
  report.push(`Skipped (no matching employee): ${skippedNoEmployee}`);
  report.push(`Skipped (fabricated backfill row - status='absent' or >30-day created_at gap): ${skippedFabricated}`);
  report.push(`Skipped (real/live data already exists for that day): ${skippedLiveDataExists}`);
  report.push('Per-employee day counts:');
  for (const [name, count] of [...perEmployeeCount.entries()].sort((a, b) => b[1] - a[1])) {
    report.push(`  ${name}: ${count}`);
  }

  const reportPath = `${dumpPath}.attendance-history-import-report.txt`;
  writeFileSync(reportPath, report.join('\n') + '\n');
  console.log(report.join('\n'));
  console.log(`\nReport written to ${reportPath}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
