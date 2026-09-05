"use client";

import Link from "next/link";
import { History } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { getAttendanceHistory } from "@/lib/api/attendance";
import { titleCase } from "@/lib/api/employees";
import { formatDate, formatTime, toDateOnlyString } from "@/lib/format";
import { PageHeader } from "@/components/hrm/page-header";
import { AttendanceCard } from "@/components/hrm/attendance-card";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { TableSkeleton } from "@/components/hrm/loading-state";
import { EmptyState } from "@/components/hrm/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function hoursLabel(workedMinutes: number | null) {
  if (workedMinutes == null) return null;
  return (workedMinutes / 60).toFixed(1);
}

export default function AttendancePage() {
  const { data, loading, error, refetch } = useAsync(() =>
    getAttendanceHistory({ from: isoDaysAgo(6) }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Check in and out, and see how this week is shaping up."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/attendance/history">
              <History />
              View history
            </Link>
          </Button>
        }
      />

      <AttendanceCard variant="full" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">This week</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncSection
            loading={loading}
            error={error}
            onRetry={refetch}
            loadingFallback={<TableSkeleton rows={5} columns={4} />}
          >
            {(data ?? []).length === 0 ? (
              <EmptyState size="sm" title="No attendance recorded this week" />
            ) : (
              <ul className="divide-y">
                {(data ?? []).map((day) => (
                  <li key={day.date} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {formatDate(day.date, { weekday: "short", day: "numeric", month: "short" })}
                      </p>
                      {day.firstCheckInAt && (
                        <p className="text-muted-foreground text-xs">
                          {formatTime(day.firstCheckInAt)} - {day.lastCheckOutAt ? formatTime(day.lastCheckOutAt) : "—"}
                          {hoursLabel(day.workedMinutes) ? ` · ${hoursLabel(day.workedMinutes)}h` : ""}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={titleCase(day.status)} />
                  </li>
                ))}
              </ul>
            )}
          </AsyncSection>
        </CardContent>
      </Card>
    </div>
  );
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toDateOnlyString(d);
}
