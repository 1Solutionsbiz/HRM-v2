"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { toDateOnlyString } from "@/lib/format";
import { getAttendanceHistory, type AttendanceDayStatus } from "@/lib/api/attendance";
import { AsyncSection } from "@/components/hrm/async-section";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// V2 doesn't track a per-day work-location field (the legacy system's
// "Home"/"Office" split), so this calendar only surfaces the statuses that
// actually exist on AttendanceDayStatus.
type Bucket = "PRESENT" | "ABSENT" | "WEEKEND" | "LEAVE" | "HOLIDAY";

function toBucket(status: AttendanceDayStatus): Bucket {
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

const BUCKET_DOT: Record<Bucket, string> = {
  PRESENT: "bg-success",
  ABSENT: "bg-destructive",
  WEEKEND: "bg-muted-foreground/40",
  LEAVE: "bg-(--chart-5)",
  HOLIDAY: "bg-warning",
};

const BUCKET_CELL: Record<Bucket, string> = {
  PRESENT: "bg-success/15 text-success",
  ABSENT: "bg-destructive/15 text-destructive",
  WEEKEND: "bg-muted text-muted-foreground",
  LEAVE: "bg-(--chart-5)/15 text-(--chart-5)",
  HOLIDAY: "bg-warning/15 text-warning",
};

const LEGEND: { bucket: Bucket; label: string }[] = [
  { bucket: "PRESENT", label: "Present" },
  { bucket: "ABSENT", label: "Absent" },
  { bucket: "WEEKEND", label: "Week off" },
  { bucket: "LEAVE", label: "Leave" },
  { bucket: "HOLIDAY", label: "Holiday" },
];

function monthGrid(year: number, month: number) {
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

export function AttendanceCalendarCard() {
  const now = React.useMemo(() => new Date(), []);
  const year = now.getFullYear();
  const month = now.getMonth();
  const days = React.useMemo(() => monthGrid(year, month), [year, month]);
  const from = toDateOnlyString(days[0]!);
  const to = toDateOnlyString(days[days.length - 1]!);

  const { data, loading, error, refetch } = useAsync(() => getAttendanceHistory({ from, to }), [from, to]);
  const byDate = new Map((data ?? []).map((d) => [d.date, d.status]));
  const monthLabel = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Attendance for {monthLabel}</CardTitle>
        <CalendarDays className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent>
        <AsyncSection
          loading={loading}
          error={error}
          onRetry={refetch}
          loadingFallback={<CardSkeleton lines={5} />}
        >
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((d) => {
              const inMonth = d.getMonth() === month;
              const dateStr = toDateOnlyString(d);
              const status = byDate.get(dateStr);
              const bucket = status ? toBucket(status) : null;
              return (
                <div
                  key={dateStr}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded text-xs",
                    !inMonth && "text-muted-foreground/40",
                    bucket && BUCKET_CELL[bucket],
                  )}
                >
                  {d.getDate()}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px]">
            {LEGEND.map((l) => (
              <div key={l.bucket} className="flex items-center gap-1.5">
                <span className={cn("size-2.5 rounded-full", BUCKET_DOT[l.bucket])} />
                <span className="text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>
        </AsyncSection>
      </CardContent>
    </Card>
  );
}
