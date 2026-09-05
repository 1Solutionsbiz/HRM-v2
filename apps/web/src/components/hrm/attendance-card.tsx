"use client";

import * as React from "react";
import { CheckCircle2, Clock, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/hrm/confirm-dialog";
import { ErrorState } from "@/components/hrm/error-state";
import { formatTime } from "@/lib/format";
import {
  checkIn as apiCheckIn,
  checkOut as apiCheckOut,
  getTodayAttendance,
  type TodayAttendance,
} from "@/lib/mock/mock-api";

function elapsedLabel(sinceIso: string, nowMs: number) {
  const minutes = Math.max(0, Math.floor((nowMs - new Date(sinceIso).getTime()) / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

interface AttendanceCardProps {
  variant?: "compact" | "full";
}

export function AttendanceCard({ variant = "full" }: AttendanceCardProps) {
  const [attendance, setAttendance] = React.useState<TodayAttendance | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [pending, setPending] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
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
    // Fetching from an external system (the mock API) on mount, not deriving
    // state from props/state - the sanctioned effect use case.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  React.useEffect(() => {
    if (attendance?.status !== "checked-in") return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [attendance?.status]);

  async function handleCheckIn() {
    setPending(true);
    try {
      const result = await apiCheckIn();
      setAttendance(result);
      toast.success(`Checked in at ${formatTime(result.checkInTime!)}`);
    } catch {
      toast.error("Couldn't check you in. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleCheckOut() {
    setPending(true);
    try {
      const result = await apiCheckOut();
      setAttendance(result);
      toast.success(`Checked out at ${formatTime(result.checkOutTime!)}`);
    } catch {
      toast.error("Couldn't check you out. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-28" />
        </CardContent>
      </Card>
    );
  }

  if (error || !attendance) {
    return (
      <Card>
        <CardContent className="pt-6">
          <ErrorState
            title="Couldn't load attendance"
            description={error?.message}
            onRetry={load}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={attendance.status === "checked-in" ? "border-success/30" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Today&apos;s attendance</CardTitle>
        <Clock className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent>
        {attendance.status === "not-checked-in" && (
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">You haven&apos;t checked in yet</p>
              <p className="text-muted-foreground text-xs">
                Office hours: 9:30 AM - 6:30 PM
              </p>
            </div>
            <Button onClick={handleCheckIn} disabled={pending}>
              <LogIn />
              {pending ? "Checking in…" : "Check in"}
            </Button>
          </div>
        )}

        {attendance.status === "checked-in" && (
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-success text-sm font-medium">
                Checked in at {formatTime(attendance.checkInTime!)}
              </p>
              <p className="text-muted-foreground text-xs">
                Worked so far: {elapsedLabel(attendance.checkInTime!, now)}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(true)}
              disabled={pending}
            >
              <LogOut />
              Check out
            </Button>
          </div>
        )}

        {attendance.status === "checked-out" && (
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
              <div>
                <p className="text-sm font-medium">Day complete</p>
                <p className="text-muted-foreground text-xs">
                  {formatTime(attendance.checkInTime!)} - {formatTime(attendance.checkOutTime!)}
                  {variant === "full" && " · " + elapsedLabel(attendance.checkInTime!, new Date(attendance.checkOutTime!).getTime()) + " worked"}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Check out for the day?"
        description={`You checked in at ${formatTime(attendance.checkInTime ?? new Date().toISOString())}. This will stop your work timer for today.`}
        confirmLabel="Check out"
        onConfirm={handleCheckOut}
      />
    </Card>
  );
}
