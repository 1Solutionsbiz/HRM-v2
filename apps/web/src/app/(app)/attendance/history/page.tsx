"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { useAsync } from "@/lib/use-async";
import { getAttendanceHistory, type AttendanceHistoryDay } from "@/lib/api/attendance";
import { titleCase } from "@/lib/api/employees";
import { formatDate, formatTime } from "@/lib/format";
import { PageHeader } from "@/components/hrm/page-header";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { TableSkeleton } from "@/components/hrm/loading-state";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const columns: ColumnDef<AttendanceHistoryDay>[] = [
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) =>
      formatDate(row.original.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
  },
  {
    accessorKey: "firstCheckInAt",
    header: "Check in",
    cell: ({ row }) => (row.original.firstCheckInAt ? formatTime(row.original.firstCheckInAt) : "—"),
  },
  {
    accessorKey: "lastCheckOutAt",
    header: "Check out",
    cell: ({ row }) => (row.original.lastCheckOutAt ? formatTime(row.original.lastCheckOutAt) : "—"),
  },
  {
    accessorKey: "workedMinutes",
    header: "Hours",
    cell: ({ row }) =>
      row.original.workedMinutes != null ? `${(row.original.workedMinutes / 60).toFixed(1)}h` : "—",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={titleCase(row.original.status)} />,
  },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function AttendanceHistoryPage() {
  // The API caps a single range at 90 days - the max history this page can show at once.
  const { data, loading, error, refetch } = useAsync(() =>
    getAttendanceHistory({ from: isoDaysAgo(89) }),
  );
  const [month, setMonth] = React.useState("all");

  const months = React.useMemo(() => {
    const set = new Set((data ?? []).map((d) => d.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [data]);

  const filtered = React.useMemo(() => {
    if (!data) return [];
    if (month === "all") return data;
    return data.filter((d) => d.date.startsWith(month));
  }, [data, month]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance history"
        description="Your full check-in/check-out record."
        actions={
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All months</SelectItem>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {formatDate(`${m}-01`, { month: "long", year: "numeric" })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <AsyncSection
            loading={loading}
            error={error}
            onRetry={refetch}
            loadingFallback={<TableSkeleton rows={8} columns={5} />}
          >
            <DataTable
              columns={columns}
              data={filtered}
              emptyTitle="No attendance records"
              emptyDescription="Nothing recorded for this month yet."
              pageSize={15}
            />
          </AsyncSection>
        </CardContent>
      </Card>
    </div>
  );
}
