import { apiFetch } from "@/lib/api-client";

export interface HandbookSection {
  id: string;
  title: string;
  body: string;
  order: number;
  updatedAt: string;
  updatedByUserId: string | null;
}

export function getHandbookSections(): Promise<HandbookSection[]> {
  return apiFetch<HandbookSection[]>("/handbook/sections");
}

export interface UpdateHandbookSectionPayload {
  title: string;
  body: string;
}

export function updateHandbookSection(
  id: string,
  payload: UpdateHandbookSectionPayload,
): Promise<HandbookSection> {
  return apiFetch<HandbookSection>(`/handbook/sections/${id}`, {
    method: "PATCH",
    body: payload,
  });
}
