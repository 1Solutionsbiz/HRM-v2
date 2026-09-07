"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { toDateOnlyString } from "@/lib/format";
import { getAttendanceHistory, getAttendancePolicy, type AttendanceHistoryDay } from "@/lib/api/attendance";
import {
  toAttendanceBucket,
  ATTENDANCE_BUCKET_LABEL,
  ATTENDANCE_BUCKET_TONE,
  ATTENDANCE_BUCKET_DOT,
  ATTENDANCE_LEGEND,
  type AttendanceBucket,
} from "@/lib/attendance-status";
import { AsyncSection } from "@/components/hrm/async-section";
import { StatusBadge } from "@/components/hrm/status-badge";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthGrid(year: number, month: number) {
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

function hoursLabel(workedMinutes: number | null) {
  if (workedMinutes == null) return null;
  const h = Math.floor(workedMinutes / 60);
  const m = workedMinutes % 60;
  return `${h}h ${m}m`;
}

export function AttendanceMonthGrid() {
  const [cursor, setCursor] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const days = React.useMemo(() => monthGrid(year, month), [year, month]);
  const from = toDateOnlyString(days[0]!);
  const to = toDateOnlyString(days[days.length - 1]!);

  const history = useAsync(() => getAttendanceHistory({ from, to }), [from, to]);
  const policy = useAsync(getAttendancePolicy);

  const byDate = React.useMemo(
    () => new Map((history.data ?? []).map((d) => [d.date, d])),
    [history.data],
  );
  const workingWeekdays = new Set(policy.data?.workingWeekdays ?? [1, 2, 3, 4, 5]);

  const monthLabel = cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const counts: Record<AttendanceBucket, number> = {
    PRESENT: 0,
    ABSENT: 0,
    WEEKEND: 0,
    LEAVE: 0,
    HOLIDAY: 0,
  };
  let totalWorkedMinutes = 0;
  for (const d of history.data ?? []) {
    if (!d.date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)) continue;
    counts[toAttendanceBucket(d.status)] += 1;
    if (d.workedMinutes) totalWorkedMinutes += d.workedMinutes;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-base">Attendance for {monthLabel}</CardTitle>
        <div className="flex items-center gap-3">
          {totalWorkedMinutes > 0 && (
            <span className="text-muted-foreground text-xs">
              Worked this month: <span className="text-foreground font-medium">{hoursLabel(totalWorkedMinutes)}</span>
            </span>
          )}
          <div className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="Previous month"
              onClick={() => setCursor(new Date(year, month - 1, 1))}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="Next month"
              onClick={() => setCursor(new Date(year, month + 1, 1))}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <AsyncSection
          loading={history.loading || policy.loading}
          error={history.error || policy.error}
          onRetry={() => {
            history.refetch();
            policy.refetch();
          }}
          loadingFallback={<CardSkeleton lines={6} />}
        >
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="bg-muted grid grid-cols-7 rounded-t-md">
                {WEEKDAY_LABELS.map((w) => (
                  <div
                    key={w}
                    className="text-muted-foreground py-2 text-center text-xs font-semibold tracking-wide uppercase"
                  >
                    {w}
                  </div>
                ))}
              </div>
              <div className="border-border grid grid-cols-7 gap-0 overflow-hidden rounded-b-md border">
                {days.map((d) => {
                  const inMonth = d.getMonth() === month;
                  const dateStr = toDateOnlyString(d);
                  const record: AttendanceHistoryDay | undefined = byDate.get(dateStr);
                  const isoWeekday = d.getDay() === 0 ? 7 : d.getDay();
                  const bucket = record
                    ? toAttendanceBucket(record.status)
                    : inMonth && !workingWeekdays.has(isoWeekday)
                      ? "WEEKEND"
                      : null;

                  return (
                    <div
                      key={dateStr}
                      className={cn(
                        "bg-card border-border/60 -mr-px -mb-px flex min-h-[92px] flex-col gap-1 border p-2",
                        !inMonth && "bg-muted/40",
                      )}
                    >
                      <span
                        className={cn(
                          "self-end text-xs font-medium",
                          inMonth ? "text-foreground" : "text-muted-foreground/50",
                        )}
                      >
                        {d.getDate()}
                      </span>
                      {inMonth && record?.workedMinutes != null && (
                        <div>
                          <p className="text-muted-foreground text-[10px]">Total hours</p>
                          <p className="text-xs font-medium tabular-nums">{hoursLabel(record.workedMinutes)}</p>
                        </div>
                      )}
                      {inMonth && bucket && (
                        <StatusBadge
                          status={ATTENDANCE_BUCKET_LABEL[bucket]}
                          tone={ATTENDANCE_BUCKET_TONE[bucket]}
                          className="mt-auto"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t pt-3 text-xs">
            {ATTENDANCE_LEGEND.map((bucket) => (
              <div key={bucket} className="flex items-center gap-1.5">
                <span className={cn("size-2.5 rounded-full", ATTENDANCE_BUCKET_DOT[bucket])} />
                <span className="text-muted-foreground">
                  {ATTENDANCE_BUCKET_LABEL[bucket]}
                  {counts[bucket] > 0 && ` (${counts[bucket]})`}
                </span>
              </div>
            ))}
          </div>
        </AsyncSection>
      </CardContent>
    </Card>
  );
}
