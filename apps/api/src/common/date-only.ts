/**
 * Shared date-only helpers for `@db.Date` columns (`AttendanceDay.date`,
 * `LeaveRequest.startDate`/`endDate`, `Holiday.date`). Two different needs,
 * easy to conflate — keep them as two functions, not one:
 *
 * - `toDateOnly`: converts a real timestamp (an actual moment, e.g. a punch)
 *   into "which calendar day does this belong to," using the host's LOCAL
 *   timezone (see AttendanceService's module comment on why that's assumed
 *   to match the company timezone).
 * - `parseDateOnly`: parses a plain "YYYY-MM-DD" string that has no
 *   time-of-day meaning at all (a query param, a leave request's
 *   startDate/endDate). Never route this through `new Date(str)` — that
 *   parses as UTC midnight, and re-reading it with local getters (as
 *   `toDateOnly` does) shifts the calendar date on any host not at UTC+0.
 */
export function toDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
