import { apiFetch } from "@/lib/api-client";

/** Sends the same weekly attendance emails the Saturday cron would, to `to` (defaults to the caller) instead of every employee and HR - safe to trigger on demand. */
export function sendTestWeeklyAttendanceReport(to?: string): Promise<void> {
  return apiFetch<void>("/reports/weekly-attendance/test", { method: "POST", body: to ? { to } : {} });
}
