import { apiFetch, apiUpload } from "@/lib/api-client";

export type AnnouncementCategory = "HOLIDAY" | "POLICY" | "EVENT" | "GENERAL";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  category: AnnouncementCategory;
  publishedByUserId: string;
  publishedAt: string;
  read: boolean;
}

export function getAnnouncements(): Promise<Announcement[]> {
  return apiFetch<Announcement[]>("/announcements");
}

export function markAnnouncementRead(id: string): Promise<void> {
  return apiFetch<void>(`/announcements/${id}/read`, { method: "PATCH" });
}

export function uploadAnnouncementImage(file: File): Promise<{ url: string }> {
  return apiUpload("/announcements/images", file);
}

export interface PublishAnnouncementPayload {
  title: string;
  body: string;
  category: AnnouncementCategory;
  imageUrl?: string;
}

export function publishAnnouncement(payload: PublishAnnouncementPayload): Promise<Announcement> {
  return apiFetch<Announcement>("/announcements", { method: "POST", body: payload });
}
