/// <reference lib="webworker" />
export {};

declare const self: ServiceWorkerGlobalScope;

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

function isPushPayload(value: unknown): value is PushPayload {
  return !!value && typeof (value as PushPayload).title === "string" && typeof (value as PushPayload).body === "string";
}

// Imported (via importScripts) into the Workbox-generated public/sw.js -
// see next.config.ts's customWorkerSrc wiring. Runs in the same worker
// global scope, so this just adds listeners to the same `self` the
// generated sw.js already owns.
self.addEventListener("push", (event: PushEvent) => {
  const parsed: unknown = event.data?.json();
  const payload: PushPayload = isPushPayload(parsed) ? parsed : { title: "1Solutions HRM", body: "You have a new notification." };

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      data: { url: payload.url ?? "/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? "/notifications";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus whatever HRM tab is already open rather than force-navigating
      // it - it may be mid-task. Only open a new tab (at the notification's
      // own target) when nothing is open at all.
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
