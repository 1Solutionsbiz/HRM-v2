import { apiFetch } from "@/lib/api-client";

export type RequestKind = "Leave" | "Expense";

export interface UnifiedRequest {
  id: string;
  kind: RequestKind;
  title: string;
  detail: string;
  status: string;
  submittedOn: string;
}

export function getMyRequests(): Promise<UnifiedRequest[]> {
  return apiFetch<UnifiedRequest[]>("/requests/mine");
}
