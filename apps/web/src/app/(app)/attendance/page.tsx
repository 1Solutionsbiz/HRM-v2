"use client";

import Link from "next/link";
import { History } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { getAttendanceHistory } from "@/lib/mock/mock-api";
import { formatDate } from "@/lib/format";
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

export default function AttendancePage() {
  const { data, loading, error, refetch } = useAsync(getAttendanceHistory);
  const thisWeek = (data ?? []).slice(-7);

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
            {thisWeek.length === 0 ? (
              <EmptyState size="sm" title="No attendance recorded this week" />
            ) : (
              <ul className="divide-y">
                {thisWeek.map((day) => (
                  <li key={day.date} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {formatDate(day.date, { weekday: "short", day: "numeric", month: "short" })}
                      </p>
                      {day.checkIn && (
                        <p className="text-muted-foreground text-xs">
                          {day.checkIn} - {day.checkOut ?? "—"}
                          {day.hours ? ` · ${day.hours}h` : ""}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={day.status} />
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
