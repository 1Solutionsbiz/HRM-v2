import { apiFetch } from "@/lib/api-client";

export type ResignationStatus = "PENDING" | "APPROVED" | "DECLINED" | "WITHDRAWN";

export interface Resignation {
  id: string;
  employeeId: string;
  reason: string;
  submittedAt: string;
  lastWorkingDay: string;
  noticePeriodDays: number;
  status: ResignationStatus;
  decidedByUserId: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
}

export function getMyResignations(): Promise<Resignation[]> {
  return apiFetch<Resignation[]>("/resignations/mine");
}

export interface SubmitResignationPayload {
  reason: string;
  lastWorkingDay: string;
}

export function submitResignation(payload: SubmitResignationPayload): Promise<Resignation> {
  return apiFetch<Resignation>("/resignations", { method: "POST", body: payload });
}

export function cancelMyResignation(id: string): Promise<Resignation> {
  return apiFetch<Resignation>(`/resignations/${id}/cancel`, { method: "PATCH" });
}

export interface CompanyResignation extends Resignation {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfJoining: string;
    designation: { title: string } | null;
    department: { name: string } | null;
  };
}

export function getCompanyResignations(): Promise<CompanyResignation[]> {
  return apiFetch<CompanyResignation[]>("/resignations/company");
}

export function decideResignation(
  id: string,
  decision: "APPROVED" | "DECLINED",
  decisionNote?: string,
): Promise<Resignation> {
  return apiFetch<Resignation>(`/resignations/${id}/decide`, {
    method: "PATCH",
    body: { decision, decisionNote },
  });
}
