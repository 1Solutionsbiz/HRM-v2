"use client";

import * as React from "react";
import { CheckCircle2, Clock, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/hrm/confirm-dialog";
import { ErrorState } from "@/components/hrm/error-state";
import { formatTime } from "@/lib/format";
import { useAttendancePunch } from "@/lib/use-attendance-punch";

function elapsedLabel(sinceIso: string, nowMs: number) {
  const minutes = Math.max(0, Math.floor((nowMs - new Date(sinceIso).getTime()) / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function minutesLabel(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

interface AttendanceCardProps {
  variant?: "compact" | "full";
}

export function AttendanceCard({ variant = "full" }: AttendanceCardProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const { attendance, loading, error, pending, now, checkIn, checkOut, reload } = useAttendancePunch();

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
            onRetry={reload}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={attendance.punchState === "CHECKED_IN" ? "border-success/30" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Today&apos;s attendance</CardTitle>
        <Clock className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent>
        {attendance.punchState === "NOT_CHECKED_IN" && (
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">You haven&apos;t checked in yet</p>
              <p className="text-muted-foreground text-xs">
                Office hours: 9:30 AM - 6:30 PM
              </p>
            </div>
            <Button onClick={checkIn} disabled={pending}>
              <LogIn />
              {pending ? "Checking in…" : "Check in"}
            </Button>
          </div>
        )}

        {attendance.punchState === "CHECKED_IN" && (
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-success text-sm font-medium">
                Checked in at {formatTime(attendance.firstCheckInAt!)}
              </p>
              <p className="text-muted-foreground text-xs">
                Worked so far: {elapsedLabel(attendance.firstCheckInAt!, now)}
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

        {attendance.punchState === "CHECKED_OUT" && (
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
              <div>
                <p className="text-sm font-medium">Day complete</p>
                <p className="text-muted-foreground text-xs">
                  {formatTime(attendance.firstCheckInAt!)} - {formatTime(attendance.lastCheckOutAt!)}
                  {variant === "full" && attendance.workedMinutes != null && ` · ${minutesLabel(attendance.workedMinutes)} worked`}
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
        description={`You checked in at ${formatTime(attendance.firstCheckInAt ?? new Date().toISOString())}. This will stop your work timer for today.`}
        confirmLabel="Check out"
        onConfirm={checkOut}
      />
    </Card>
  );
}
