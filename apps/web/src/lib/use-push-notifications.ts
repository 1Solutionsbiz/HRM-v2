import * as React from "react";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/api/push-subscriptions";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** web-push's VAPID key is URL-safe base64; PushManager.subscribe wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

type PushPermission = "default" | "granted" | "denied";

/**
 * Shared push-notification state for the Settings toggle - mirrors
 * use-install-prompt.ts's shape (a supported/state/action hook the UI just
 * renders branches off of). `supported` is false whenever the Push API
 * itself is unavailable (Safari on a plain tab, very old browsers) or the
 * env var isn't set (no VAPID key configured yet in this deployment).
 */
export function usePushNotifications() {
  // All four defaults below match what the server render sees (no
  // window) - the effect below is what's allowed to flip them once
  // mounted, same sanctioned pattern as use-install-prompt.ts's
  // isStandalone()/isIos(). Computing `supported` inline from
  // `typeof window` instead of through state would give the server render
  // and the client's first render different values - a hydration mismatch.
  const [supported, setSupported] = React.useState(false);
  const [permission, setPermission] = React.useState<PushPermission>("default");
  const [isSubscribed, setIsSubscribed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const supportsPush = "serviceWorker" in navigator && "PushManager" in window && !!VAPID_PUBLIC_KEY;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(supportsPush);
    if (!supportsPush) return;
    setPermission(Notification.permission as PushPermission);
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setIsSubscribed(!!subscription))
      .catch(() => {
        // Not fatal - the Enable button just stays available to retry.
      });
  }, []);

  const subscribe = React.useCallback(async () => {
    if (!supported || !VAPID_PUBLIC_KEY) return;
    setBusy(true);
    setError(null);
    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== "granted") return;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Browser returned an incomplete push subscription.");
      }
      await subscribeToPush({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } });
      setIsSubscribed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't enable push notifications.");
    } finally {
      setBusy(false);
    }
  }, [supported]);

  const unsubscribe = React.useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await unsubscribeFromPush(endpoint);
      }
      setIsSubscribed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't disable push notifications.");
    } finally {
      setBusy(false);
    }
  }, [supported]);

  return { supported, permission, isSubscribed, busy, error, subscribe, unsubscribe };
}
