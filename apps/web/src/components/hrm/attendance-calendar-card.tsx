"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { toDateOnlyString } from "@/lib/format";
import { getAttendanceHistory, getAttendancePolicy } from "@/lib/api/attendance";
import {
  toAttendanceBucket,
  ATTENDANCE_BUCKET_DOT,
  ATTENDANCE_BUCKET_CELL,
  ATTENDANCE_LEGEND,
  ATTENDANCE_BUCKET_LABEL,
} from "@/lib/attendance-status";
import { AsyncSection } from "@/components/hrm/async-section";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function monthGrid(year: number, month: number) {
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // A fixed 6 rows leaves a trailing all-blank week for months that only
  // need 5 (e.g. one starting on a Tuesday) - size the grid to what this
  // month actually needs instead.
  const weeksNeeded = Math.ceil((firstOfMonth.getDay() + daysInMonth) / 7);
  return Array.from({ length: weeksNeeded * 7 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

interface AttendanceCalendarCardProps {
  /** When set, shows a "Go to calendar" link in the header pointing here. */
  linkHref?: string;
  className?: string;
}

export function AttendanceCalendarCard({ linkHref, className }: AttendanceCalendarCardProps) {
  const [cursor, setCursor] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const todayStr = toDateOnlyString(new Date());

  const days = React.useMemo(() => monthGrid(year, month), [year, month]);
  const from = toDateOnlyString(days[0]!);
  const to = toDateOnlyString(days[days.length - 1]!);

  const history = useAsync(() => getAttendanceHistory({ from, to }), [from, to]);
  const policy = useAsync(getAttendancePolicy);
  const byDate = new Map((history.data ?? []).map((d) => [d.date, d.status]));
  // getAttendanceHistory only returns a WEEKEND row for past dates (today or
  // later with no record is omitted entirely, not synthesized) - falling
  // back to the policy's own workingWeekdays here keeps future Saturdays/
  // Sundays tinted instead of rendering as unstyled blanks.
  const workingWeekdays = new Set(policy.data?.workingWeekdays ?? [1, 2, 3, 4, 5]);
  const monthLabel = cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Calendar</CardTitle>
        <div className="flex items-center gap-2">
          {linkHref && (
            <Link href={linkHref} className="text-primary text-xs font-medium hover:underline">
              Go to calendar
            </Link>
          )}
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Previous month"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Next month"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
          >
            <ChevronRight className="size-3.5" />
          </Button>
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
          loadingFallback={<CardSkeleton lines={5} />}
        >
          <p className="text-muted-foreground mb-2 text-xs font-medium">{monthLabel}</p>
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
              const isoWeekday = d.getDay() === 0 ? 7 : d.getDay();
              const bucket = status
                ? toAttendanceBucket(status)
                : !workingWeekdays.has(isoWeekday)
                  ? "WEEKEND"
                  : null;
              const isToday = dateStr === todayStr;

              return (
                <div
                  key={dateStr}
                  title={inMonth && bucket ? ATTENDANCE_BUCKET_LABEL[bucket] : undefined}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-full text-xs",
                    inMonth && bucket && ATTENDANCE_BUCKET_CELL[bucket],
                    inMonth && isToday && "ring-primary ring-2",
                  )}
                >
                  {inMonth ? d.getDate() : ""}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-nowrap items-center gap-x-2 overflow-x-auto text-[10px] whitespace-nowrap">
            <div className="flex items-center gap-1">
              <span className="border-primary size-2 shrink-0 rounded-full border-2" />
              <span className="text-muted-foreground">Today</span>
            </div>
            {ATTENDANCE_LEGEND.map((bucket) => (
              <div key={bucket} className="flex items-center gap-1">
                <span className={cn("size-2 shrink-0 rounded-full", ATTENDANCE_BUCKET_DOT[bucket])} />
                <span className="text-muted-foreground">{ATTENDANCE_BUCKET_LABEL[bucket]}</span>
              </div>
            ))}
          </div>
        </AsyncSection>
      </CardContent>
    </Card>
  );
}
