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
