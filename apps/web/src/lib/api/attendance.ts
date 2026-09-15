import { apiFetch } from "@/lib/api-client";

export type PunchState = "NOT_CHECKED_IN" | "CHECKED_IN" | "CHECKED_OUT";
export type AttendanceDayStatus =
  | "PRESENT"
  | "LATE"
  | "HALF_DAY"
  | "ABSENT"
  | "ON_LEAVE"
  | "HOLIDAY"
  | "WEEKEND";

export interface TodayAttendance {
  date: string;
  punchState: PunchState;
  status: AttendanceDayStatus | null;
  firstCheckInAt: string | null;
  lastCheckOutAt: string | null;
  workedMinutes: number | null;
  lateMinutes: number;
}

export function getTodayAttendance(): Promise<TodayAttendance> {
  return apiFetch<TodayAttendance>("/attendance/today");
}

export interface PunchLocation {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

export function checkIn(location?: PunchLocation): Promise<TodayAttendance> {
  return apiFetch<TodayAttendance>("/attendance/check-in", { method: "POST", body: location ?? {} });
}

export function checkOut(location?: PunchLocation): Promise<TodayAttendance> {
  return apiFetch<TodayAttendance>("/attendance/check-out", { method: "POST", body: location ?? {} });
}

export interface AttendanceHistoryDay {
  date: string;
  status: AttendanceDayStatus;
  firstCheckInAt: string | null;
  lastCheckOutAt: string | null;
  workedMinutes: number | null;
  lateMinutes: number;
}

export function getAttendanceHistory(params?: {
  from?: string;
  to?: string;
}): Promise<AttendanceHistoryDay[]> {
  const search = new URLSearchParams();
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  const qs = search.toString();
  return apiFetch<AttendanceHistoryDay[]>(`/attendance/history${qs ? `?${qs}` : ""}`);
}

export interface AttendancePolicy {
  standardStartTime: string;
  standardEndTime: string;
  graceMinutes: number;
  halfDayThresholdHours: string | number;
  fullDayHours: string | number;
  workingWeekdays: number[];
}

export function getAttendancePolicy(): Promise<AttendancePolicy> {
  return apiFetch<AttendancePolicy>("/attendance/policy");
}

export type CompanyAttendanceStatus = AttendanceDayStatus | "NOT_MARKED";

export interface CompanyAttendanceRow {
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  department: { name: string } | null;
  designation: { title: string } | null;
  status: CompanyAttendanceStatus;
  firstCheckInAt: string | null;
  lastCheckOutAt: string | null;
  workedMinutes: number | null;
  lateMinutes: number;
}

export function getCompanyAttendance(date?: string): Promise<CompanyAttendanceRow[]> {
  return apiFetch<CompanyAttendanceRow[]>(`/attendance/company${date ? `?date=${date}` : ""}`);
}

export function getEmployeeAttendanceHistory(
  employeeId: string,
  params?: { from?: string; to?: string },
): Promise<AttendanceHistoryDay[]> {
  const search = new URLSearchParams();
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  const qs = search.toString();
  return apiFetch<AttendanceHistoryDay[]>(`/attendance/employees/${employeeId}/history${qs ? `?${qs}` : ""}`);
}

export type AttendanceCorrectionType = "CHECK_IN" | "CHECK_OUT" | "BREAK_START" | "BREAK_END";

/**
 * HR/admin manual correction. Adds a new event that supersedes the
 * existing one of the same type for that day (by insertion order, not by
 * occurredAt) — see AttendanceService.recordCorrection/recomputeDay. The
 * response is a raw AttendanceDay row, not the `today`-shaped object this
 * used to be typed as, so callers should refetch the roster/history rather
 * than merge the response.
 */
export function recordAttendanceCorrection(
  employeeId: string,
  input: { type: AttendanceCorrectionType; occurredAt: string; note?: string },
): Promise<unknown> {
  return apiFetch<unknown>(`/attendance/employees/${employeeId}/corrections`, {
    method: "POST",
    body: { type: input.type, occurredAt: input.occurredAt, note: input.note },
  });
}

/** Sends a [TEST]-labelled preview of the missing-checkout reminder to the caller only — never the real employees. See MissingCheckoutReminderService.sendTest. */
export function sendMissingCheckoutReminderTest(): Promise<{ missingCheckoutCount: number }> {
  return apiFetch<{ missingCheckoutCount: number }>("/attendance/missing-checkout-reminders/test", {
    method: "POST",
  });
}
