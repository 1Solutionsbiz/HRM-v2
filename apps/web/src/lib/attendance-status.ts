import type { AttendanceDayStatus } from "@/lib/api/attendance";
import type { StatusTone } from "@/components/hrm/status-badge";

// V2 doesn't track a per-day work-location field (the legacy system's
// "Home"/"Office" split), so every attendance calendar only surfaces the
// statuses that actually exist on AttendanceDayStatus.
export type AttendanceBucket = "PRESENT" | "ABSENT" | "WEEKEND" | "LEAVE" | "HOLIDAY";

export function toAttendanceBucket(status: AttendanceDayStatus): AttendanceBucket {
  switch (status) {
    case "PRESENT":
    case "LATE":
    case "HALF_DAY":
      return "PRESENT";
    case "ABSENT":
      return "ABSENT";
    case "WEEKEND":
      return "WEEKEND";
    case "ON_LEAVE":
      return "LEAVE";
    case "HOLIDAY":
      return "HOLIDAY";
  }
}

export const ATTENDANCE_BUCKET_LABEL: Record<AttendanceBucket, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  WEEKEND: "Week off",
  LEAVE: "Leave",
  HOLIDAY: "Holiday",
};

export const ATTENDANCE_BUCKET_TONE: Record<AttendanceBucket, StatusTone> = {
  PRESENT: "success",
  ABSENT: "destructive",
  WEEKEND: "neutral",
  LEAVE: "info",
  HOLIDAY: "warning",
};

export const ATTENDANCE_BUCKET_DOT: Record<AttendanceBucket, string> = {
  PRESENT: "bg-success",
  ABSENT: "bg-destructive",
  WEEKEND: "bg-muted-foreground/40",
  LEAVE: "bg-info",
  HOLIDAY: "bg-warning",
};

/** Tinted-background + colored-text pair for a small calendar cell. */
export const ATTENDANCE_BUCKET_CELL: Record<AttendanceBucket, string> = {
  PRESENT: "bg-success/15 text-success",
  ABSENT: "bg-destructive/15 text-destructive",
  WEEKEND: "bg-muted text-muted-foreground",
  LEAVE: "bg-info/15 text-info",
  HOLIDAY: "bg-warning/15 text-warning",
};

export const ATTENDANCE_LEGEND: AttendanceBucket[] = [
  "PRESENT",
  "ABSENT",
  "WEEKEND",
  "LEAVE",
  "HOLIDAY",
];
