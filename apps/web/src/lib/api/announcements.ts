import { apiFetch } from "@/lib/api-client";

export type AnnouncementCategory = "HOLIDAY" | "POLICY" | "EVENT" | "GENERAL";

export interface Announcement {
  id: string;
  title: string;
  body: string;
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

export interface PublishAnnouncementPayload {
  title: string;
  body: string;
  category: AnnouncementCategory;
}

export function publishAnnouncement(payload: PublishAnnouncementPayload): Promise<Announcement> {
  return apiFetch<Announcement>("/announcements", { method: "POST", body: payload });
}
