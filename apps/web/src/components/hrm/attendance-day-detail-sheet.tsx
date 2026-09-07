"use client";

import { formatDate, formatTime } from "@/lib/format";
import type { AttendanceHistoryDay, AttendancePolicy } from "@/lib/api/attendance";
import {
  toAttendanceBucket,
  ATTENDANCE_BUCKET_LABEL,
  ATTENDANCE_BUCKET_TONE,
} from "@/lib/attendance-status";
import { StatusBadge } from "@/components/hrm/status-badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface AttendanceDayDetailSheetProps {
  date: string;
  record: AttendanceHistoryDay | undefined;
  policy: AttendancePolicy | undefined;
  onOpenChange: (open: boolean) => void;
}

function hoursLabel(workedMinutes: number | null | undefined) {
  if (!workedMinutes) return null;
  const h = Math.floor(workedMinutes / 60);
  const m = workedMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Shift-timing fields are MySQL TIME columns Prisma serializes as a
// 1970-01-01 UTC datetime - a wall-clock time, not a real instant, so it
// must be read with UTC getters (same reasoning as
// AttendanceService.isLate on the backend). Using local getters here would
// shift the displayed hour by the viewer's UTC offset.
function formatShiftTime(iso: string) {
  const d = new Date(iso);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

const NO_PUNCH_MESSAGE: Partial<Record<ReturnType<typeof toAttendanceBucket>, string>> = {
  WEEKEND: "Week off - no attendance expected.",
  HOLIDAY: "Company holiday - no attendance expected.",
  LEAVE: "On approved leave this day.",
  ABSENT: "No check-in was recorded for this day.",
};

export function AttendanceDayDetailSheet({ date, record, policy, onOpenChange }: AttendanceDayDetailSheetProps) {
  const status = record?.status;
  const bucket = status ? toAttendanceBucket(status) : null;
  const worked = hoursLabel(record?.workedMinutes);
  const hasPunches = !!(record?.firstCheckInAt || record?.lastCheckOutAt);

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle>{formatDate(date, { day: "numeric", month: "short", year: "numeric" })}</SheetTitle>
            {bucket && <StatusBadge status={ATTENDANCE_BUCKET_LABEL[bucket]} tone={ATTENDANCE_BUCKET_TONE[bucket]} />}
          </div>
        </SheetHeader>

        <div className="space-y-4 px-4">
          {worked && <p className="text-sm">Working hours: <span className="font-medium">{worked}</span></p>}

          {policy && (
            <p className="text-muted-foreground text-sm">
              Shift: {formatShiftTime(policy.standardStartTime)} – {formatShiftTime(policy.standardEndTime)}
            </p>
          )}

          {hasPunches ? (
            <div className="flex gap-3">
              <div className="bg-muted flex-1 rounded-lg px-3 py-2">
                <p className="text-muted-foreground text-xs font-medium">In-time</p>
                <p className="mt-0.5 text-sm font-semibold">
                  {record?.firstCheckInAt ? formatTime(record.firstCheckInAt) : "-"}
                </p>
              </div>
              <div className="bg-muted flex-1 rounded-lg px-3 py-2">
                <p className="text-muted-foreground text-xs font-medium">Out-time</p>
                <p className="mt-0.5 text-sm font-semibold">
                  {record?.lastCheckOutAt ? formatTime(record.lastCheckOutAt) : "-"}
                </p>
              </div>
            </div>
          ) : (
            bucket && (
              <p className="text-muted-foreground text-sm">
                {NO_PUNCH_MESSAGE[bucket] ?? "No attendance recorded for this day."}
              </p>
            )
          )}

          {record && record.lateMinutes > 0 && (
            <p className="text-warning-foreground dark:text-warning text-sm">
              Checked in {record.lateMinutes} min late.
            </p>
          )}

          {!record && (
            <p className="text-muted-foreground text-sm">No attendance record exists for this day.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
