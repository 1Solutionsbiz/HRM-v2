"use client";

import * as React from "react";
import { CheckCircle2, Clock, UserX } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { getCompanyAttendance } from "@/lib/api/attendance";
import { titleCase } from "@/lib/api/employees";
import { formatTime, toDateOnlyString } from "@/lib/format";
import { PageHeader } from "@/components/hrm/page-header";
import { StatCard } from "@/components/hrm/stat-card";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { StatGridSkeleton, TableSkeleton } from "@/components/hrm/loading-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export default function TeamAttendancePage() {
  const [date, setDate] = React.useState<Date>(new Date());
  const dateStr = toDateOnlyString(date);

  const { data, loading, error, refetch } = useAsync(() => getCompanyAttendance(dateStr), [dateStr]);

  const rows = data ?? [];
  const present = rows.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
  const late = rows.filter((r) => r.status === "LATE").length;
  const absent = rows.filter((r) => r.status === "ABSENT").length;
  const onLeave = rows.filter((r) => r.status === "ON_LEAVE").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team attendance"
        description="Review your team's daily attendance."
        actions={<DatePicker value={date} onChange={(d) => d && setDate(d)} />}
      />

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={refetch}
        loadingFallback={<StatGridSkeleton count={4} />}
      >
        {data && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Present" value={String(present)} icon={CheckCircle2} tone="success" />
            <StatCard label="Late" value={String(late)} icon={Clock} tone="warning" />
            <StatCard label="Absent" value={String(absent)} icon={UserX} />
            <StatCard label="On leave" value={String(onLeave)} />
          </div>
        )}
      </AsyncSection>

      <Card>
        <CardContent className="pt-6">
          <AsyncSection
            loading={loading}
            error={error}
            onRetry={refetch}
            loadingFallback={<TableSkeleton rows={8} columns={5} />}
          >
            {rows.length === 0 ? (
              <EmptyState icon={Clock} title="No active employees" />
            ) : (
              <ul className="divide-y">
                {rows.map((r) => (
                  <li key={r.employeeId} className="flex items-center gap-3 py-3">
                    <Avatar className="size-8 shrink-0">
                      <AvatarFallback className="text-xs">{initials(r.firstName, r.lastName)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {r.firstName} {r.lastName}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {r.designation?.title ?? "—"} · {r.department?.name ?? "—"}
                      </p>
                    </div>
                    <div className="text-muted-foreground hidden shrink-0 text-xs sm:block">
                      {r.firstCheckInAt ? formatTime(r.firstCheckInAt) : "—"} -{" "}
                      {r.lastCheckOutAt ? formatTime(r.lastCheckOutAt) : "—"}
                      {r.workedMinutes != null && ` · ${(r.workedMinutes / 60).toFixed(1)}h`}
                    </div>
                    <StatusBadge status={titleCase(r.status)} className="shrink-0" />
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
