/**
 * Shared date-only helpers for `@db.Date` columns (`AttendanceDay.date`,
 * `LeaveRequest.startDate`/`endDate`, `Holiday.date`). Two different needs,
 * easy to conflate — keep them as two functions, not one:
 *
 * - `toDateOnly`: converts a real timestamp (an actual moment, e.g. a punch)
 *   into "which calendar day does this belong to," always in the company's
 *   own timezone (Asia/Kolkata - see COMPANY_TIME_ZONE), regardless of what
 *   timezone the host process itself happens to be running in.
 * - `parseDateOnly`: parses a plain "YYYY-MM-DD" string that has no
 *   time-of-day meaning at all (a query param, a leave request's
 *   startDate/endDate). Never route this through `new Date(str)` — that
 *   parses as UTC midnight, and re-reading it with local getters would
 *   shift the calendar date on any host not at UTC+0.
 *
 * `toDateOnly` used to read the host's LOCAL getters (getFullYear/
 * getMonth/getDate), on the documented assumption that the host process's
 * own timezone was set to Asia/Kolkata. That assumption was false in
 * production (the host runs on UTC) - confirmed live on 2026-09-15: for
 * roughly the first 5.5 hours after real midnight IST every day, the
 * server still thought it was the previous UTC calendar day, so
 * "today's" attendance/leave/report logic was silently working against
 * yesterday. A punch made in that window would even land on the wrong
 * `AttendanceDay` row via `@@unique([employeeId, date])`. Fixed by
 * resolving the calendar day through Intl with an explicit timeZone,
 * which is correct no matter how the host itself is configured - no
 * env var or deployment step to remember or get wrong.
 */
const COMPANY_TIME_ZONE = 'Asia/Kolkata';

const dateOnlyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: COMPANY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function toDateOnly(date: Date): Date {
  // en-CA formats as "YYYY-MM-DD" directly - no part-by-part reassembly needed.
  const [year, month, day] = dateOnlyFormatter.format(date).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

const timeOfDayFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: COMPANY_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/**
 * Minutes since local midnight, in the company's timezone, for a real
 * instant - the wall-clock-hour sibling of `toDateOnly`. Same rationale:
 * `.getHours()`/`.getMinutes()` read the HOST's timezone, which is not
 * guaranteed to be Asia/Kolkata (confirmed false in production - see
 * toDateOnly's own comment). Found live via AttendanceService's
 * computeLateMinutes: a 2026-09-10 17:58 IST check-in (12:28 UTC) was
 * scored against a UTC host as if "12:28" were the wall-clock time,
 * silently UNDER-counting lateness by ~5.5h worth of minutes for anyone
 * arriving after ~14:35 IST.
 */
export function minutesOfDayInCompanyTimeZone(date: Date): number {
  const parts = timeOfDayFormatter.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')!.value);
  const minute = Number(parts.find((p) => p.type === 'minute')!.value);
  return hour * 60 + minute;
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
