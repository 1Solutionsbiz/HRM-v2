import { apiFetch } from "@/lib/api-client";

export interface EmployeeOfTheMonthAward {
  id: string;
  periodMonth: number;
  periodYear: number;
  note: string | null;
  nominatedAt: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    employeeCode: string;
    designation: { title: string } | null;
    department: { name: string } | null;
  };
}

export function getCurrentEmployeeOfTheMonth(): Promise<EmployeeOfTheMonthAward | null> {
  return apiFetch<EmployeeOfTheMonthAward | null>("/employee-of-the-month/current");
}

export interface NominateEmployeeOfTheMonthPayload {
  employeeId: string;
  note?: string;
}

export function nominateEmployeeOfTheMonth(
  payload: NominateEmployeeOfTheMonthPayload,
): Promise<EmployeeOfTheMonthAward> {
  return apiFetch<EmployeeOfTheMonthAward>("/employee-of-the-month", {
    method: "POST",
    body: payload,
  });
}
