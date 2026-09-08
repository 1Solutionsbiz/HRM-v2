"use client";

import * as React from "react";
import Link from "next/link";
import { LogIn, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/hrm/confirm-dialog";
import { formatDate, formatTime } from "@/lib/format";
import { useAttendancePunch } from "@/lib/use-attendance-punch";

interface AttendanceBannerProps {
  firstName: string;
  description: string;
  /** Renders a "Profile - X% Completed" bar under the description when given. */
  profileCompletionPercent?: number;
  /** Adds a settings shortcut icon-button next to the check-in/out control. */
  showSettingsLink?: boolean;
}

// The blue top bar every dashboard variant shares: greeting, today's date,
// and the same check-in/out control as AttendanceCard (via the shared
// useAttendancePunch hook) surfaced prominently instead of buried in a card.
export function AttendanceBanner({
  firstName,
  description,
  profileCompletionPercent,
  showSettingsLink,
}: AttendanceBannerProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const { attendance, loading, pending, checkIn, checkOut } = useAttendancePunch();

  return (
    <div className="bg-primary text-primary-foreground flex flex-col gap-4 rounded-lg p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Hello, {firstName}!
          </h2>
          <p className="text-primary-foreground/80 text-sm">{description}</p>
        </div>
        {profileCompletionPercent !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-primary-foreground/80 shrink-0 text-xs">
              Profile - <span className="font-semibold text-primary-foreground">{profileCompletionPercent}% Completed</span>
            </span>
            <div className="bg-primary-foreground/20 h-1.5 w-32 overflow-hidden rounded-full">
              <div
                className="bg-primary-foreground h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, profileCompletionPercent))}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col items-start gap-2 sm:items-end">
        <p className="text-primary-foreground/80 text-sm font-medium">
          {formatDate(new Date(), { weekday: "long", month: "long", day: "numeric" })}
        </p>

        {loading ? (
          <Skeleton className="bg-primary-foreground/20 h-9 w-32" />
        ) : !attendance ? null : (
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <div className="flex items-center gap-2">
              {attendance.punchState === "NOT_CHECKED_IN" && (
                <Button onClick={checkIn} disabled={pending} variant="secondary">
                  <LogIn />
                  {pending ? "Checking in…" : "Mark attendance"}
                </Button>
              )}
              {attendance.punchState === "CHECKED_IN" && (
                <Button
                  variant="secondary"
                  onClick={() => setConfirmOpen(true)}
                  disabled={pending}
                >
                  <LogOut />
                  Check out
                </Button>
              )}
              {showSettingsLink && (
                <Button asChild variant="secondary" size="icon">
                  <Link href="/settings" aria-label="Settings">
                    <Settings />
                  </Link>
                </Button>
              )}
            </div>

            {attendance.punchState === "NOT_CHECKED_IN" && (
              <p className="text-primary-foreground/80 text-xs">You haven&apos;t checked in yet</p>
            )}
            {attendance.punchState === "CHECKED_IN" && (
              <p className="text-primary-foreground/80 text-xs">
                Last punch - checked in {formatTime(attendance.firstCheckInAt!)}
              </p>
            )}
            {attendance.punchState === "CHECKED_OUT" && (
              <p className="text-primary-foreground/80 text-xs">
                Last punch - checked out {formatTime(attendance.lastCheckOutAt!)}
              </p>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Check out for the day?"
        description={`You checked in at ${formatTime(attendance?.firstCheckInAt ?? new Date().toISOString())}. This will stop your work timer for today.`}
        confirmLabel="Check out"
        onConfirm={checkOut}
      />
    </div>
  );
}
