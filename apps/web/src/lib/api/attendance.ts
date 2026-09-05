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

export function checkIn(): Promise<TodayAttendance> {
  return apiFetch<TodayAttendance>("/attendance/check-in", { method: "POST" });
}

export function checkOut(): Promise<TodayAttendance> {
  return apiFetch<TodayAttendance>("/attendance/check-out", { method: "POST" });
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
