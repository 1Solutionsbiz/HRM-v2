import { apiFetch } from "@/lib/api-client";

export interface Holiday {
  id: string;
  name: string;
  date: string;
  isActive: boolean;
}

export function getHolidays(): Promise<Holiday[]> {
  return apiFetch<Holiday[]>("/holidays");
}

export interface HolidayPayload {
  name: string;
  date: string;
}

export function createHoliday(payload: HolidayPayload): Promise<Holiday> {
  return apiFetch<Holiday>("/holidays", { method: "POST", body: payload });
}

export function updateHoliday(id: string, payload: Partial<HolidayPayload>): Promise<Holiday> {
  return apiFetch<Holiday>(`/holidays/${id}`, { method: "PATCH", body: payload });
}

export function deleteHoliday(id: string): Promise<void> {
  return apiFetch<void>(`/holidays/${id}`, { method: "DELETE" });
}
