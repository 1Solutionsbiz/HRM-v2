import { apiFetch } from "@/lib/api-client";

export type NotificationType = "LEAVE" | "EXPENSE" | "ATTENDANCE" | "ANNOUNCEMENT" | "SYSTEM";

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  description: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export function getNotifications(): Promise<AppNotification[]> {
  return apiFetch<AppNotification[]>("/notifications");
}

export function markNotificationRead(id: string): Promise<AppNotification> {
  return apiFetch<AppNotification>(`/notifications/${id}/read`, { method: "PATCH" });
}

export function markAllNotificationsRead(): Promise<{ count: number }> {
  return apiFetch<{ count: number }>("/notifications/read-all", { method: "PATCH" });
}
