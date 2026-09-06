// One-off gap-fill import: newer legacy leave requests for the 7
// currently-ACTIVE employees, scraped live from hrmpulse.com's
// Leaves(Admin) -> "All Leaves" admin table, not a fresh phpMyAdmin dump.
//
// Why this is needed: import-legacy-phase2.ts sourced leave data from a
// point-in-time SQL dump. The legacy system kept accumulating real leave
// requests after that dump was taken - checked production directly and
// found each active employee's newest *imported* request stops well
// before hrmpulse.com's actual latest entries (e.g. Shivam Singhaniya's
// newest imported row: 2025-08-21, but hrmpulse.com has entries for him
// through 2026-08-11). This script brings the newer ones in. There's no
// SQL/DB access to legacy's live database (PROJECT_STATUS.md's binding
// rules forbid touching it directly) - only what's visible through the
// admin UI, hence a live scrape (see the sibling legacy-leaves.json,
// produced by reading hrmpulse.com's own rendered table) instead of a
// dump.
//
// Idempotent, but NOT via phase-2's delete-and-rebuild pattern - that
// would also wipe every other (including inactive) employee's
// already-correct historical rows this script has no data for. Instead:
// skip-if-duplicate per row (matched on employeeId + leaveTypeId +
// startDate + endDate), then recompute LeaveBalance.usedDays for every
// touched employeeId/leaveTypeId/year key from ALL matching LeaveRequest
// rows (existing + newly inserted) - same "sum then upsert absolute
// value" approach phase-2 itself used - so re-running this script is safe
// and never double-counts.
//
// Deliberately does NOT touch AttendanceDay (unlike the live
// decide()-approval endpoint's markAttendanceDaysOnLeave). Matches
// phase-2's own precedent for bulk historical leave import, which never
// touched attendance either - these employees' attendance history comes
// from a separately-imported source (import-legacy-attendance-history.ts)
// that may already correctly reflect real punches for these dates, and
// this script has no basis to override that.
//
// Run: npx tsx --env-file=<path-to-hrm-api.env> prisma/import-legacy-leaves-gap-fill.ts <path-to-legacy-leaves.json> <path-to-employee-type-map.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { parseDateOnly } from '../src/common/date-only.js';

interface LegacyRow {
  employee: string;
  leaveType: string;
  dayType: string;
  appliedTime: string; // "YYYY-MM-DD HH:MM:SS", IST wall-clock (same host as the attendance dump)
  from: string; // "YYYY-MM-DD" - confirmed by direct DOM read of the "All Leaves" modal table (its date columns render ISO, unlike the dashboard's smaller "recent leaves" widget which renders DD-MM-YYYY - do not conflate the two formats)
  to: string;
  days: string;
  reason: string;
  status: string;
}

interface EmployeeTypeMap {
  active: { id: string; code: string; name: string }[];
  types: { id: string; key: string; name: string }[];
}

/** "YYYY-MM-DD HH:MM:SS" IST wall-clock -> true UTC instant (IST = UTC+5:30). */
function istToUtc(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number) as unknown as number[];
  return new Date(Date.UTC(y!, mo! - 1, d!, h! - 5, mi! - 30, s ?? 0));
}

function mapDayType(raw: string): { dayType: 'FULL_DAY' | 'HALF_DAY'; halfDayPeriod: 'MORNING' | 'AFTERNOON' | null } | null {
  switch (raw.trim()) {
    case 'Full Day':
      return { dayType: 'FULL_DAY', halfDayPeriod: null };
    case 'First Half Day':
      return { dayType: 'HALF_DAY', halfDayPeriod: 'MORNING' };
    case 'Second Half Day':
      return { dayType: 'HALF_DAY', halfDayPeriod: 'AFTERNOON' };
    // Plain "Half Day" with no AM/PM split - genuinely unknown which half,
    // so null rather than guessing.
    case 'Half Day':
      return { dayType: 'HALF_DAY', halfDayPeriod: null };
    // Legacy's own distinct "Short Leave" leave TYPE always pairs with this
    // day type in the data seen; no MORNING/AFTERNOON distinction exists
    // for it - closest fit is HALF_DAY/MORNING, same default phase-2 used
    // for its own ambiguous day_type=3 case.
    case 'Short Leave':
      return { dayType: 'HALF_DAY', halfDayPeriod: 'MORNING' };
    default:
      return null;
  }
}

function daysBetweenInclusive(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

/**
 * `totalDays` is computed from our own day-type/leave-type semantics, not
 * trusted from legacy's raw `no_of_days` text - same principle
 * import-legacy-attendance-history.ts applies to status/lateMinutes
 * ("not trusted from legacy's own status/late_status labels"). Concretely:
 * legacy records "1" for every HALF_DAY row (Casual Leave/Loss of Pay),
 * but V2's own applyLeave() always treats a half day as 0.5 - importing
 * legacy's literal "1" would silently double-count half-day usage against
 * LeaveBalance.usedDays relative to how the live app itself accounts for
 * it. "Short Leave" is different again: it's real legacy data at 0 for
 * every row seen (matches LeaveType.defaultAnnualDays=0 for this type -
 * short leave was never day-counted against a bank at all).
 */
function computeTotalDays(leaveTypeName: string, dayType: 'FULL_DAY' | 'HALF_DAY', startDate: Date, endDate: Date): number {
  if (leaveTypeName === 'Short Leave') return 0;
  if (dayType === 'HALF_DAY') return 0.5;
  return daysBetweenInclusive(startDate, endDate);
}

function mapStatus(raw: string): 'APPROVED' | 'REJECTED' | 'PENDING' | null {
  switch (raw.trim()) {
    case 'Approved':
      return 'APPROVED';
    case 'Declined':
    case 'Rejected':
      return 'REJECTED';
    case 'Pending':
      return 'PENDING';
    default:
      return null;
  }
}

async function main() {
  const rowsPath = process.argv[2];
  const mapPath = process.argv[3];
  if (!rowsPath || !mapPath) {
    console.error(
      'usage: tsx import-legacy-leaves-gap-fill.ts <path-to-legacy-leaves.json> <path-to-employee-type-map.json>',
    );
    process.exit(1);
  }
  const rows: LegacyRow[] = JSON.parse(readFileSync(rowsPath, 'utf8'));
  const map: EmployeeTypeMap = JSON.parse(readFileSync(mapPath, 'utf8'));
  const report: string[] = [];

  const adapter = new PrismaMariaDb(process.env.DATABASE_URL as string);
  const prisma = new PrismaClient({ adapter });

  const employeeByName = new Map(map.active.map((e) => [e.name.trim(), e]));
  const typeByName = new Map(map.types.map((t) => [t.name.trim(), t]));

  report.push(`Source rows: ${rows.length}`);
  report.push(`Active employees in scope: ${map.active.map((e) => e.name).join(', ')}`);

  let imported = 0;
  let skippedInactiveEmployee = 0;
  let skippedUnmappedType = 0;
  let skippedUnmappedDayType = 0;
  let skippedUnmappedStatus = 0;
  let skippedBadDates = 0;
  let skippedDuplicate = 0;
  const touchedBalanceKeys = new Set<string>(); // `${employeeId}|${leaveTypeId}|${year}`

  for (const r of rows) {
    const employee = employeeByName.get(r.employee.trim());
    if (!employee) {
      skippedInactiveEmployee++;
      continue; // not one of the 7 active employees - out of scope, not an error
    }
    const leaveType = typeByName.get(r.leaveType.trim());
    if (!leaveType) {
      skippedUnmappedType++;
      report.push(`SKIPPED (unmapped leave type "${r.leaveType}") - ${employee.name}, ${r.from} to ${r.to}`);
      continue;
    }
    const dayTypeInfo = mapDayType(r.dayType);
    if (!dayTypeInfo) {
      skippedUnmappedDayType++;
      report.push(`SKIPPED (unmapped day type "${r.dayType}") - ${employee.name}, ${r.from} to ${r.to}`);
      continue;
    }
    const status = mapStatus(r.status);
    if (!status) {
      skippedUnmappedStatus++;
      report.push(`SKIPPED (unmapped status "${r.status}") - ${employee.name}, ${r.from} to ${r.to}`);
      continue;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.from) || !/^\d{4}-\d{2}-\d{2}$/.test(r.to)) {
      skippedBadDates++;
      report.push(`SKIPPED (unexpected date format) - ${employee.name}: from="${r.from}" to="${r.to}"`);
      continue;
    }
    const startDate = parseDateOnly(r.from);
    const endDate = parseDateOnly(r.to);
    if (startDate > endDate) {
      skippedBadDates++;
      report.push(`SKIPPED (startDate after endDate) - ${employee.name}, ${r.from} to ${r.to}`);
      continue;
    }

    const existing = await prisma.leaveRequest.findFirst({
      where: { employeeId: employee.id, leaveTypeId: leaveType.id, startDate, endDate, status },
    });
    if (existing) {
      skippedDuplicate++;
      continue; // already present, either from phase-2's dump or a prior run of this script
    }

    const totalDays = computeTotalDays(leaveType.name, dayTypeInfo.dayType, startDate, endDate);
    const submittedAt = istToUtc(r.appliedTime) ?? startDate;
    const counter = await prisma.sequenceCounter.update({
      where: { key: 'leaveRequestCode' },
      data: { value: { increment: 1 } },
    });
    const code = `LV-${String(counter.value).padStart(4, '0')}`;

    await prisma.leaveRequest.create({
      data: {
        code,
        employeeId: employee.id,
        leaveTypeId: leaveType.id,
        startDate,
        endDate,
        dayType: dayTypeInfo.dayType,
        halfDayPeriod: dayTypeInfo.halfDayPeriod,
        totalDays,
        reason: r.reason.trim() || 'No reason on file',
        status,
        submittedAt,
      },
    });
    imported++;

    if (status === 'APPROVED') {
      touchedBalanceKeys.add(`${employee.id}|${leaveType.id}|${startDate.getUTCFullYear()}`);
    }
  }

  report.push(`Imported: ${imported}`);
  report.push(`Skipped (not an active employee - out of scope): ${skippedInactiveEmployee}`);
  report.push(`Skipped (unmapped leave type): ${skippedUnmappedType}`);
  report.push(`Skipped (unmapped day type): ${skippedUnmappedDayType}`);
  report.push(`Skipped (unmapped status): ${skippedUnmappedStatus}`);
  report.push(`Skipped (bad/unexpected dates): ${skippedBadDates}`);
  report.push(`Skipped (duplicate of an already-imported request): ${skippedDuplicate}`);

  report.push(`\nRecomputing LeaveBalance.usedDays for ${touchedBalanceKeys.size} employee/type/year key(s)...`);
  for (const key of touchedBalanceKeys) {
    const [employeeId, leaveTypeId, yearStr] = key.split('|') as [string, string, string];
    const year = Number(yearStr);
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
    const approved = await prisma.leaveRequest.findMany({
      where: { employeeId, leaveTypeId, status: 'APPROVED', startDate: { gte: yearStart, lt: yearEnd } },
      select: { totalDays: true },
    });
    const usedDays = approved.reduce((sum, r) => sum + r.totalDays.toNumber(), 0);
    const leaveType = await prisma.leaveType.findUniqueOrThrow({ where: { id: leaveTypeId } });
    await prisma.leaveBalance.upsert({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
      create: { employeeId, leaveTypeId, year, allocatedDays: leaveType.defaultAnnualDays, usedDays },
      update: { usedDays },
    });
    report.push(`  ${key}: usedDays -> ${usedDays} (from ${approved.length} approved request(s))`);
  }

  const reportPath = `${rowsPath}.gap-fill-import-report.txt`;
  writeFileSync(reportPath, report.join('\n') + '\n');
  console.log(report.join('\n'));
  console.log(`\nReport written to ${reportPath}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
