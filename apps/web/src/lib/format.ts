export function formatINR(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

/**
 * A date-only "YYYY-MM-DD" string from a locally-constructed Date (e.g. one
 * a Calendar/DatePicker returns, which is local midnight). Never use
 * `date.toISOString().slice(0, 10)` for this — it reads the date in UTC,
 * which silently shifts a day backward for any host west of... no, for any
 * host at a *positive* UTC offset (IST included): local midnight minus the
 * offset crosses into the previous UTC calendar day. Use local getters
 * instead, same reasoning as the backend's date-only.ts.
 */
export function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDate(iso: string | Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Date(iso).toLocaleDateString("en-IN", opts);
}

export function formatDateShort(iso: string | Date) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function formatTime(iso: string | Date) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

/**
 * Minutes between two "HH:mm" clock times (e.g. a daily-report task's
 * start/end). Null if either is missing/malformed. A negative raw
 * difference (end earlier than start) is treated as crossing midnight,
 * not a bad input — same "informational, not validated" posture as the
 * fields themselves.
 */
export function minutesBetween(startTime: string | null | undefined, endTime: string | null | undefined): number | null {
  if (!startTime || !endTime) return null;
  const start = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(startTime);
  const end = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(endTime);
  if (!start || !end) return null;
  const startMinutes = Number(start[1]) * 60 + Number(start[2]);
  const endMinutes = Number(end[1]) * 60 + Number(end[2]);
  const diff = endMinutes - startMinutes;
  return diff >= 0 ? diff : diff + 24 * 60;
}

/** "2h 15m" / "45m" / "3h" - used alongside minutesBetween for a task's Total time. */
export function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateShort(iso);
}
