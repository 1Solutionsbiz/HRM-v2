"use client";

import * as React from "react";
import { toast } from "sonner";
import { formatTime } from "@/lib/format";
import { ApiError } from "@/lib/api-client";
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

  React.useEffect(() => {
    if (attendance?.punchState !== "CHECKED_IN") return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [attendance?.punchState]);

  async function checkIn() {
    setPending(true);
    try {
      const result = await apiCheckIn();
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
      const result = await apiCheckOut();
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
