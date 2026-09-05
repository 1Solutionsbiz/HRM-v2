"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { useAsync } from "@/lib/use-async";
import { getAttendanceHistory } from "@/lib/mock/mock-api";
import { formatDate } from "@/lib/format";
import type { AttendanceDay } from "@/lib/mock/fixtures";
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

const columns: ColumnDef<AttendanceDay>[] = [
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) =>
      formatDate(row.original.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
  },
  {
    accessorKey: "checkIn",
    header: "Check in",
    cell: ({ row }) => row.original.checkIn ?? "—",
  },
  {
    accessorKey: "checkOut",
    header: "Check out",
    cell: ({ row }) => row.original.checkOut ?? "—",
  },
  {
    accessorKey: "hours",
    header: "Hours",
    cell: ({ row }) => (row.original.hours ? `${row.original.hours}h` : "—"),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
];

export default function AttendanceHistoryPage() {
  const { data, loading, error, refetch } = useAsync(getAttendanceHistory);
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
