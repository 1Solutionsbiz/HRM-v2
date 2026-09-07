"use client";

import { useAsync } from "@/lib/use-async";
import { toDateOnlyString, formatTime } from "@/lib/format";
import { getAttendanceHistory } from "@/lib/api/attendance";
import { AsyncSection } from "@/components/hrm/async-section";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function yesterdayDateOnly(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateOnlyString(d);
}

function hoursLabel(workedMinutes: number | null) {
  if (!workedMinutes) return "00:00";
  const h = Math.floor(workedMinutes / 60);
  const m = workedMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function YesterdayAttendanceCard() {
  const yesterday = yesterdayDateOnly();
  const { data, loading, error, refetch } = useAsync(
    () => getAttendanceHistory({ from: yesterday, to: yesterday }),
    [yesterday],
  );
  const day = data?.[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Yesterday&apos;s attendance</CardTitle>
      </CardHeader>
      <CardContent>
        <AsyncSection
          loading={loading}
          error={error}
          onRetry={refetch}
          loadingFallback={<CardSkeleton lines={2} />}
        >
          <div className="flex items-center gap-4">
            <div>
              <p className="text-2xl font-semibold tabular-nums">{hoursLabel(day?.workedMinutes ?? null)}</p>
              <p className="text-muted-foreground text-xs">Total working hours</p>
            </div>
            <div className="bg-border h-8 w-px" />
            <div className="flex gap-3">
              <div className="bg-muted rounded-lg px-3 py-2 text-center">
                <span className="text-muted-foreground text-xs font-medium">In-time</span>
                <p className="mt-0.5 text-xs font-semibold">
                  {day?.firstCheckInAt ? formatTime(day.firstCheckInAt) : "-"}
                </p>
              </div>
              <div className="bg-muted rounded-lg px-3 py-2 text-center">
                <span className="text-muted-foreground text-xs font-medium">Out-time</span>
                <p className="mt-0.5 text-xs font-semibold">
                  {day?.lastCheckOutAt ? formatTime(day.lastCheckOutAt) : "-"}
                </p>
              </div>
            </div>
          </div>
        </AsyncSection>
      </CardContent>
    </Card>
  );
}
