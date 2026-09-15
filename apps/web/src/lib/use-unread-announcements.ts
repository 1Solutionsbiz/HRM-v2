"use client";

import * as React from "react";
import { getAnnouncements } from "@/lib/api/announcements";

/**
 * Drives the "New" nav badge on Announcements (sidebar + mobile More sheet).
 * Refetches on focus/visibility, same reasoning as useAttendancePunch - a
 * long-lived tab shouldn't keep showing a stale unread count.
 */
export function useUnreadAnnouncementsCount(): number {
  const [count, setCount] = React.useState(0);

  const load = React.useCallback(() => {
    getAnnouncements()
      .then((data) => setCount(data.filter((a) => !a.read).length))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    load();
    function onForeground() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", onForeground);
    window.addEventListener("focus", load);
    return () => {
      document.removeEventListener("visibilitychange", onForeground);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  return count;
}
