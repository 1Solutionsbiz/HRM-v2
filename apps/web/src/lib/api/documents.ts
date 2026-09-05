import { apiFetch } from "@/lib/api-client";

export type DocumentStatus = "VERIFIED" | "PENDING_REVIEW" | "MISSING" | "REJECTED";
export type DocumentCategory = "IDENTITY" | "EDUCATION" | "BANKING" | "EMPLOYMENT";

export interface DocumentChecklistItem {
  documentTypeId: string;
  key: string;
  name: string;
  category: DocumentCategory;
  status: DocumentStatus;
  fileUrl: string | null;
  uploadedAt: string | null;
  verifiedAt: string | null;
  notes: string | null;
}

export function getMyDocuments(): Promise<DocumentChecklistItem[]> {
  return apiFetch<DocumentChecklistItem[]>("/documents/mine");
}

export function submitDocument(documentTypeId: string, fileUrl: string) {
  return apiFetch(`/documents/mine/${documentTypeId}/submit`, {
    method: "POST",
    body: { fileUrl },
  });
}

export function getEmployeeDocuments(employeeId: string): Promise<DocumentChecklistItem[]> {
  return apiFetch<DocumentChecklistItem[]>(`/documents/employees/${employeeId}`);
}

export type DocumentDecision = "VERIFIED" | "REJECTED";

export function decideDocument(
  employeeId: string,
  documentTypeId: string,
  decision: DocumentDecision,
  notes?: string,
) {
  return apiFetch(`/documents/employees/${employeeId}/${documentTypeId}/verify`, {
    method: "PATCH",
    body: { decision, notes: notes || undefined },
  });
}
