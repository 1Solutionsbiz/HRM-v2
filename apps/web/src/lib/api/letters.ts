import { apiDownload, apiFetch } from "@/lib/api-client";

export interface LetterEmployeeSummary {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  department: { name: string } | null;
  designation: { title: string } | null;
}

export interface LetterTypeSummary {
  id: string;
  key: string;
  name: string;
  numberPrefix: string;
  isActive: boolean;
  /** Which `custom.*` fields this type's template needs - drives which inputs the generate form renders. */
  customVariableKeys: string[];
}

export interface LetterCategory {
  id: string;
  key: string;
  name: string;
  types: LetterTypeSummary[];
}

export interface GeneratedLetter {
  id: string;
  documentNumber: string;
  status: "GENERATED" | "CANCELLED";
  generatedAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  employeeId: string;
  employee: { firstName: string; lastName: string; employeeCode: string } | null;
  letterType: { name: string } | null;
}

export interface LetterPreview {
  letterTypeName: string;
  paragraphs: string[];
  signatoryName: string;
  signatoryTitle: string;
  dateLabel: string;
}

export interface GenerateLetterInput {
  employeeId: string;
  letterTypeId: string;
  templateId?: string;
  customVariables?: Record<string, string>;
}

export function searchLetterEmployees(q: string): Promise<LetterEmployeeSummary[]> {
  const query = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return apiFetch<LetterEmployeeSummary[]>(`/letters/employees${query}`);
}

export function getLetterCategories(): Promise<LetterCategory[]> {
  return apiFetch<LetterCategory[]>("/letters/categories");
}

export function previewLetter(input: GenerateLetterInput): Promise<LetterPreview> {
  return apiFetch<LetterPreview>("/letters/preview", { method: "POST", body: input });
}

export function generateLetter(input: GenerateLetterInput): Promise<GeneratedLetter> {
  return apiFetch<GeneratedLetter>("/letters/generate", { method: "POST", body: input });
}

export function listGeneratedLetters(employeeId?: string): Promise<GeneratedLetter[]> {
  const query = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : "";
  return apiFetch<GeneratedLetter[]>(`/letters${query}`);
}

export function cancelLetter(id: string, reason: string): Promise<GeneratedLetter> {
  return apiFetch<GeneratedLetter>(`/letters/${id}/cancel`, { method: "PATCH", body: { reason } });
}

export async function downloadLetter(id: string, documentNumber: string): Promise<void> {
  const blob = await apiDownload(`/letters/${id}/download`);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${documentNumber.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
