"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useAsync } from "@/lib/use-async";
import { formatDate, formatTime } from "@/lib/format";
import { getAuditLogs, type AuditLogEntry } from "@/lib/api/admin";
import { titleCase } from "@/lib/api/employees";
import { PageHeader } from "@/components/hrm/page-header";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { TableSkeleton } from "@/components/hrm/loading-state";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent } from "@/components/ui/card";

const columns: ColumnDef<AuditLogEntry>[] = [
  {
    accessorKey: "occurredAt",
    header: "When",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {formatDate(row.original.occurredAt)} · {formatTime(row.original.occurredAt)}
      </span>
    ),
  },
  { accessorKey: "actorName", header: "Actor" },
  {
    accessorKey: "eventType",
    header: "Action",
    cell: ({ row }) => titleCase(row.original.eventType),
  },
  {
    id: "target",
    header: "Target",
    cell: ({ row }) =>
      row.original.targetType ? `${row.original.targetType}${row.original.targetId ? ` · ${row.original.targetId.slice(0, 8)}` : ""}` : "—",
  },
  {
    accessorKey: "ipAddress",
    header: "IP address",
    cell: ({ row }) => row.original.ipAddress ?? "—",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge
        status={titleCase(row.original.status)}
        tone={row.original.status === "SUCCESS" ? "success" : "destructive"}
      />
    ),
  },
];

export default function SystemLogsPage() {
  const { data, loading, error, refetch } = useAsync(() => getAuditLogs(200));

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
              searchColumn="actorName"
              searchPlaceholder="Search by actor…"
              pageSize={15}
            />
          </AsyncSection>
        </CardContent>
      </Card>
    </div>
  );
}
