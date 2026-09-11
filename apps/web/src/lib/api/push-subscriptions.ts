import { apiFetch } from "@/lib/api-client";

/** Mirrors the browser's `PushSubscription.toJSON()` shape exactly. */
export interface PushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export function subscribeToPush(subscription: PushSubscriptionPayload): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/push-subscriptions", { method: "POST", body: subscription });
}

export function unsubscribeFromPush(endpoint: string): Promise<void> {
  return apiFetch<void>(`/push-subscriptions?endpoint=${encodeURIComponent(endpoint)}`, { method: "DELETE" });
}
