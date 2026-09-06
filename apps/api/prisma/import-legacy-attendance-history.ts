// One-off legacy-data import: historical attendance from `newuser_attendance`
// (238 rows, Dec 2024 - Feb 2025, 14 distinct employees). Queued since Phase
// 3 - see PROJECT_STATUS.md's "Deliberately still not imported" note - and
// safe to run unlike `hrm_attandance_machine_detail` (which identifies
// employees by ambiguous first-name strings, not id, and needs manual
// disambiguation first).
//
// Parses the same phpMyAdmin dump used by every prior phase. Idempotent:
// each (employeeId, date) this script would produce is deleted and
// recreated on every run (AttendanceDay's onDelete: Cascade takes its
// AttendanceEvent children with it), so it can be safely re-run.
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
// Run: npx tsx --env-file=<path-to-hrm-api.env> prisma/import-legacy-attendance-history.ts <path-to-dump.sql>
import { readFileSync, writeFileSync } from 'node:fs';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client.js';

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
