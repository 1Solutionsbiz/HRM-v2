import { toDateOnlyString } from "@/lib/format";

export type Period = "day" | "week" | "month" | "quarter";

export const PERIODS: { value: Period; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
];

/**
 * The {from, to} date-only range for a period anchored at `ref` - week is
 * Monday-start, quarter follows the calendar (Jan-Mar, Apr-Jun, ...). Shared
 * by every page that offers a day/week/month/quarter toggle (team/attendance,
 * team/reports) so the boundary math can't quietly drift between them.
 */
export function rangeForPeriod(period: Period, ref: Date): { from: string; to: string } {
  if (period === "day") {
    const s = toDateOnlyString(ref);
    return { from: s, to: s };
  }
  if (period === "week") {
    const day = ref.getDay(); // 0 = Sun .. 6 = Sat
    const monday = new Date(ref);
    monday.setDate(ref.getDate() + (day === 0 ? -6 : 1 - day));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: toDateOnlyString(monday), to: toDateOnlyString(sunday) };
  }
  if (period === "month") {
    const first = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    return { from: toDateOnlyString(first), to: toDateOnlyString(last) };
  }
  const quarterStartMonth = Math.floor(ref.getMonth() / 3) * 3;
  const first = new Date(ref.getFullYear(), quarterStartMonth, 1);
  const last = new Date(ref.getFullYear(), quarterStartMonth + 3, 0);
  return { from: toDateOnlyString(first), to: toDateOnlyString(last) };
}
