"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { ClipboardList, Clock, Megaphone, UserCheck, Users } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { toDateOnlyString, formatRelativeTime } from "@/lib/format";
import { getMyProfile, getEmployees, employeeFullName } from "@/lib/api/employees";
import { getCompanyAttendance } from "@/lib/api/attendance";
import { getCompanyLeaveRequests } from "@/lib/api/leave";
import { getCompanyExpenseClaims } from "@/lib/api/expenses";
import { getAnnouncements } from "@/lib/api/announcements";
import { PageHeader } from "@/components/hrm/page-header";
import { StatCard } from "@/components/hrm/stat-card";
import { ChartCard } from "@/components/hrm/chart-card";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { CardSkeleton, StatGridSkeleton } from "@/components/hrm/loading-state";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AttendanceTrendChart, type AttendanceTrendPoint } from "./attendance-trend-chart";

interface TeamRequestRow {
  id: string;
  employee: string;
  type: string;
  date: string;
  status: "Pending" | "Approved" | "Rejected";
}

const requestColumns: ColumnDef<TeamRequestRow>[] = [
  { accessorKey: "employee", header: "Employee" },
  { accessorKey: "type", header: "Type" },
  { accessorKey: "date", header: "Date" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
];

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function currentWeekdays(): Date[] {
  const today = new Date();
  const isoDay = today.getDay() === 0 ? 7 : today.getDay(); // 1=Mon..7=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - (isoDay - 1));
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

async function fetchTeamData() {
  const [me, employees] = await Promise.all([getMyProfile(), getEmployees()]);
  const reports = employees.filter((e) => e.manager?.id === me.id && e.status === "ACTIVE");
  const reportIds = new Set(reports.map((e) => e.id));

  const weekdays = currentWeekdays();
  const days = await Promise.all(weekdays.map((d) => getCompanyAttendance(toDateOnlyString(d))));

  const trend: AttendanceTrendPoint[] = days.map((rows, i) => {
    const teamRows = rows.filter((r) => reportIds.has(r.employeeId));
    return {
      day: WEEKDAY_LABELS[i]!,
      present: teamRows.filter((r) => r.status === "PRESENT" || r.status === "LATE").length,
      onLeave: teamRows.filter((r) => r.status === "ON_LEAVE").length,
    };
  });

  const todayRows = days[days.length - 1] ?? [];
  const todayTeamRows = todayRows.filter((r) => reportIds.has(r.employeeId));
  const presentToday = todayTeamRows.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
  const onLeaveToday = todayTeamRows.filter((r) => r.status === "ON_LEAVE").length;

  return { reports, reportIds, trend, presentToday, onLeaveToday };
}

export function ManagerDashboard({ firstName }: { firstName: string }) {
  const team = useAsync(fetchTeamData);
  const leaveRequests = useAsync(getCompanyLeaveRequests);
  const expenseClaims = useAsync(getCompanyExpenseClaims);
  const announcements = useAsync(getAnnouncements);

  const reportIds = team.data?.reportIds ?? new Set<string>();
  const teamLeave = (leaveRequests.data ?? []).filter((r) => reportIds.has(r.employee.id));
  const teamExpense = (expenseClaims.data ?? []).filter((e) => reportIds.has(e.employee.id));
  const pendingApprovals =
    teamLeave.filter((r) => r.status === "PENDING").length +
    teamExpense.filter((e) => e.status === "PENDING").length;

  const requestRows: TeamRequestRow[] = [
    ...teamLeave.map((r) => ({
      id: r.id,
      employee: employeeFullName(r.employee),
      type: `Leave (${r.leaveType.name})`,
      date: r.startDate,
      status:
        r.status === "PENDING" ? ("Pending" as const) : r.status === "APPROVED" ? ("Approved" as const) : ("Rejected" as const),
    })),
    ...teamExpense.map((e) => ({
      id: e.id,
      employee: employeeFullName(e.employee),
      type: `Expense (${e.category.name})`,
      date: e.expenseDate,
      status:
        e.status === "PENDING" ? ("Pending" as const) : e.status === "APPROVED" ? ("Approved" as const) : ("Rejected" as const),
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const unreadAnnouncements = (announcements.data ?? []).filter((a) => !a.read);
  const statsLoading = team.loading || leaveRequests.loading || expenseClaims.loading;

  return (
    <div className="space-y-6">
      <PageHeader title={`Good to see you, ${firstName}`} description="Manager" />

      <AsyncSection
        loading={statsLoading}
        error={team.error || leaveRequests.error || expenseClaims.error}
        onRetry={() => {
          team.refetch();
          leaveRequests.refetch();
          expenseClaims.refetch();
        }}
        loadingFallback={<StatGridSkeleton count={4} />}
      >
        {team.data && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Team present today"
              value={`${team.data.presentToday} / ${team.data.reports.length}`}
              icon={UserCheck}
              tone="success"
            />
            <StatCard label="Pending approvals" value={String(pendingApprovals)} icon={ClipboardList} tone="warning" />
            <StatCard label="Team size" value={String(team.data.reports.length)} icon={Users} tone="teal" />
            <StatCard label="On leave today" value={String(team.data.onLeaveToday)} icon={Clock} tone="violet" />
          </div>
        )}
      </AsyncSection>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Team attendance this week" description="Direct reports only, current work week.">
            <AsyncSection
              loading={team.loading}
              error={team.error}
              onRetry={team.refetch}
              loadingFallback={<CardSkeleton lines={5} />}
            >
              <AttendanceTrendChart data={team.data?.trend ?? []} />
            </AsyncSection>
          </ChartCard>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Announcements</CardTitle>
            <Megaphone className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent className="space-y-4">
            <AsyncSection
              loading={announcements.loading}
              error={announcements.error}
              onRetry={announcements.refetch}
              loadingFallback={<CardSkeleton lines={3} />}
            >
              {unreadAnnouncements.length === 0 ? (
                <EmptyState size="sm" icon={Megaphone} title="You're all caught up" />
              ) : (
                unreadAnnouncements.slice(0, 4).map((a) => (
                  <div key={a.id} className="space-y-1 border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{a.title}</p>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {formatRelativeTime(a.publishedAt)}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs">{a.body}</p>
                  </div>
                ))
              )}
            </AsyncSection>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Team requests</CardTitle>
          <ClipboardList className="text-muted-foreground size-4" />
        </CardHeader>
        <CardContent>
          <AsyncSection
            loading={leaveRequests.loading || expenseClaims.loading}
            error={leaveRequests.error || expenseClaims.error}
            onRetry={() => {
              leaveRequests.refetch();
              expenseClaims.refetch();
            }}
            loadingFallback={<CardSkeleton lines={4} />}
          >
            {requestRows.length === 0 ? (
              <EmptyState size="sm" icon={ClipboardList} title="No requests from your team yet" />
            ) : (
              <DataTable columns={requestColumns} data={requestRows} />
            )}
          </AsyncSection>
        </CardContent>
      </Card>
    </div>
  );
}
