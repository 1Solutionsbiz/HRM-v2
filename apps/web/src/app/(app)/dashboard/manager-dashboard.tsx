"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { ClipboardList, Megaphone } from "lucide-react";
import { PageHeader } from "@/components/hrm/page-header";
import { StatCard } from "@/components/hrm/stat-card";
import { ChartCard } from "@/components/hrm/chart-card";
import { StatusBadge } from "@/components/hrm/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AttendanceTrendChart } from "./attendance-trend-chart";
import {
  getDashboardStats,
  sampleAnnouncements,
  sampleTeamRequests,
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

export function ManagerDashboard({ firstName }: { firstName: string }) {
  const stats = getDashboardStats("manager");

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good to see you, ${firstName}`}
        description="Engineering Manager · Viewing as Manager (preview)"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            tone={stat.tone}
            trend={stat.trend}
            description={stat.description}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard
            title="Team attendance this week"
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
            {sampleAnnouncements.map((a) => (
              <div key={a.title} className="space-y-1 border-b pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{a.title}</p>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {a.time}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-xs">{a.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Team requests</CardTitle>
          <ClipboardList className="text-muted-foreground size-4" />
        </CardHeader>
        <CardContent>
          <DataTable columns={requestColumns} data={sampleTeamRequests} />
        </CardContent>
      </Card>
    </div>
  );
}
