"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { CalendarDays, ClipboardList, Megaphone, Wallet } from "lucide-react";
import { useRole } from "@/lib/role-context";
import { ROLE_LABELS } from "@/types/role";
import { PageHeader } from "@/components/hrm/page-header";
import { StatCard } from "@/components/hrm/stat-card";
import { ChartCard } from "@/components/hrm/chart-card";
import { StatusBadge } from "@/components/hrm/status-badge";
import { EmptyState } from "@/components/hrm/empty-state";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AttendanceTrendChart } from "./attendance-trend-chart";
import {
  getDashboardStats,
  sampleAnnouncements,
  samplePayslips,
  sampleTeamRequests,
  type SamplePayslip,
  type SampleRequest,
} from "./dashboard-data";

const requestColumns: ColumnDef<SampleRequest>[] = [
  { accessorKey: "employee", header: "Employee" },
  { accessorKey: "type", header: "Type" },
  { accessorKey: "date", header: "Date" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
];

const payslipColumns: ColumnDef<SamplePayslip>[] = [
  { accessorKey: "month", header: "Month" },
  { accessorKey: "net", header: "Net pay" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
];

export default function DashboardPage() {
  const { role, user } = useRole();
  const stats = getDashboardStats(role);
  const isPeopleManager = role === "manager" || role === "hr" || role === "admin";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good to see you, ${user.name.split(" ")[0]}`}
        description={`${user.designation} · Viewing as ${ROLE_LABELS[role]} (preview)`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            trend={stat.trend}
            description={stat.description}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard
            title={isPeopleManager ? "Team attendance this week" : "Your attendance this week"}
            description="Sample data - live attendance will connect once the API exists."
          >
            <AttendanceTrendChart />
          </ChartCard>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Announcements</CardTitle>
            <Megaphone className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent className="space-y-4">
            {sampleAnnouncements.length ? (
              sampleAnnouncements.map((a) => (
                <div key={a.title} className="space-y-1 border-b pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{a.title}</p>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {a.time}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">{a.body}</p>
                </div>
              ))
            ) : (
              <EmptyState
                size="sm"
                icon={Megaphone}
                title="No announcements yet"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            {isPeopleManager ? "Team requests" : "Recent payslips"}
          </CardTitle>
          {isPeopleManager ? (
            <ClipboardList className="text-muted-foreground size-4" />
          ) : (
            <Wallet className="text-muted-foreground size-4" />
          )}
        </CardHeader>
        <CardContent>
          {isPeopleManager ? (
            <DataTable columns={requestColumns} data={sampleTeamRequests} />
          ) : (
            <DataTable columns={payslipColumns} data={samplePayslips} />
          )}
        </CardContent>
      </Card>

      {!isPeopleManager && (
        <EmptyState
          icon={CalendarDays}
          title="No upcoming leave scheduled"
          description="Apply for leave and it will show up here once the Leave module is built."
        />
      )}
    </div>
  );
}
