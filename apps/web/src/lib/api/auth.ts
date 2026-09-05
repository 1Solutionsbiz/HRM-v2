import { apiFetch } from "@/lib/api-client";

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiFetch<void>("/auth/change-password", {
    method: "POST",
    body: { currentPassword, newPassword },
  });
}
