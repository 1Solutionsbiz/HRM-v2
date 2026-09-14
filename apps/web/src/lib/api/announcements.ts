import { apiFetch, apiUpload } from "@/lib/api-client";

export type AnnouncementCategory = "HOLIDAY" | "POLICY" | "EVENT" | "GENERAL" | "NEW_HIRE";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  category: AnnouncementCategory;
  /** Null for a system-generated post, e.g. the new-hire welcome feed item. */
  publishedByUserId: string | null;
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

export interface UpdateAnnouncementPayload {
  title: string;
  body: string;
  category: AnnouncementCategory;
  imageUrl: string | null;
}

export function updateAnnouncement(id: string, payload: UpdateAnnouncementPayload): Promise<Announcement> {
  return apiFetch<Announcement>(`/announcements/${id}`, { method: "PATCH", body: payload });
}
