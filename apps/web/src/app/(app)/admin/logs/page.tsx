"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useAsync } from "@/lib/use-async";
import { formatDate, formatTime } from "@/lib/format";
import { getAuditLogs } from "@/lib/mock/mock-api";
import type { AuditLogEntry } from "@/lib/mock/hr-fixtures";
import { PageHeader } from "@/components/hrm/page-header";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { TableSkeleton } from "@/components/hrm/loading-state";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent } from "@/components/ui/card";

const columns: ColumnDef<AuditLogEntry>[] = [
  {
    accessorKey: "timestamp",
    header: "When",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {formatDate(row.original.timestamp)} · {formatTime(row.original.timestamp)}
      </span>
    ),
  },
  { accessorKey: "actor", header: "Actor" },
  { accessorKey: "action", header: "Action" },
  { accessorKey: "target", header: "Target" },
  { accessorKey: "ip", header: "IP address" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge status={row.original.status} tone={row.original.status === "Success" ? "success" : "destructive"} />
    ),
  },
];

export default function SystemLogsPage() {
  const { data, loading, error, refetch } = useAsync(getAuditLogs);

  return (
    <div className="space-y-6">
      <PageHeader title="System logs" description="Login activity and administrative actions." />

      <Card>
        <CardContent className="pt-6">
          <AsyncSection
            loading={loading}
            error={error}
            onRetry={refetch}
            loadingFallback={<TableSkeleton rows={8} columns={6} />}
          >
            <DataTable
              columns={columns}
              data={data ?? []}
              searchColumn="actor"
              searchPlaceholder="Search by actor…"
              pageSize={15}
            />
          </AsyncSection>
        </CardContent>
      </Card>
    </div>
  );
}
