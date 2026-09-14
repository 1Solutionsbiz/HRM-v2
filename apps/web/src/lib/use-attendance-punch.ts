"use client";

import * as React from "react";
import { toast } from "sonner";
import { formatTime } from "@/lib/format";
import { ApiError } from "@/lib/api-client";
import { getCurrentLocation } from "@/lib/geolocation";
import {
  checkIn as apiCheckIn,
  checkOut as apiCheckOut,
  getTodayAttendance,
  type TodayAttendance,
} from "@/lib/api/attendance";

// Shared by AttendanceCard and AttendanceBanner so the two surfaces can't
// drift on check-in/out behavior - see either component for the UI.
export function useAttendancePunch() {
  const [attendance, setAttendance] = React.useState<TodayAttendance | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [pending, setPending] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    getTodayAttendance()
      .then(setAttendance)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Refetch whenever the app comes back to the foreground - without this,
  // a PWA left open overnight (backgrounded, not closed) keeps showing
  // yesterday's punch state after midnight, since nothing ever re-fetches
  // on its own. Caught live: "checked out 6:15 PM" still showing at
  // 12:39 PM the next day, with no button to check in for the new day,
  // because the stale state matched neither NOT_CHECKED_IN nor
  // CHECKED_IN. Both listeners, not just one - visibilitychange doesn't
  // reliably fire in every mobile PWA context, focus does.
  React.useEffect(() => {
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

  React.useEffect(() => {
    if (attendance?.punchState !== "CHECKED_IN") return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [attendance?.punchState]);

  async function checkIn() {
    setPending(true);
    try {
      const location = await getCurrentLocation();
      const result = await apiCheckIn(location);
      setAttendance(result);
      toast.success(`Checked in at ${formatTime(result.firstCheckInAt!)}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't check you in. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function checkOut() {
    setPending(true);
    try {
      const location = await getCurrentLocation();
      const result = await apiCheckOut(location);
      setAttendance(result);
      toast.success(`Checked out at ${formatTime(result.lastCheckOutAt!)}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't check you out. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return { attendance, loading, error, pending, now, checkIn, checkOut, reload: load };
}
