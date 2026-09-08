"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { type ColumnDef } from "@tanstack/react-table";
import { UserMinus } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { formatDate } from "@/lib/format";
import {
  decideResignation,
  getCompanyResignations,
  type CompanyResignation,
} from "@/lib/api/resignations";
import { employeeFullName, employeeInitials, titleCase } from "@/lib/api/employees";
import { PageHeader } from "@/components/hrm/page-header";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { ConfirmDialog } from "@/components/hrm/confirm-dialog";
import { TableSkeleton } from "@/components/hrm/loading-state";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

function EmployeeCell({ employee }: { employee: CompanyResignation["employee"] }) {
  return (
    <Link
      href={`/people/employees/${employee.id}`}
      className="flex items-center gap-2.5 text-left hover:underline"
    >
      <Avatar className="size-7 shrink-0">
        <AvatarFallback className="text-[10px]">{employeeInitials(employee)}</AvatarFallback>
      </Avatar>
      <span className="truncate text-sm font-medium">{employeeFullName(employee)}</span>
    </Link>
  );
}

export default function ResignationsPage() {
  const { data, loading, error, refetch } = useAsync(getCompanyResignations);
  const [decision, setDecision] = React.useState<{ id: string; name: string; kind: "APPROVED" | "DECLINED" } | null>(null);

  async function handleDecide() {
    if (!decision) return;
    await decideResignation(decision.id, decision.kind);
    toast.success(`${decision.name}'s resignation ${decision.kind === "APPROVED" ? "approved" : "declined"}`);
    refetch();
  }

  const columns: ColumnDef<CompanyResignation>[] = [
    {
      id: "employee",
      accessorFn: (row) => employeeFullName(row.employee),
      header: "Employee",
      cell: ({ row }) => <EmployeeCell employee={row.original.employee} />,
    },
    {
      id: "designation",
      accessorFn: (row) => row.employee.designation?.title ?? "",
      header: "Designation",
      cell: ({ row }) => row.original.employee.designation?.title ?? "—",
    },
    {
      id: "dateOfJoining",
      accessorFn: (row) => row.employee.dateOfJoining,
      header: "Date of joining",
      cell: ({ row }) => formatDate(row.original.employee.dateOfJoining),
    },
    {
      id: "resignationDate",
      accessorFn: (row) => row.submittedAt,
      header: "Resignation date",
      cell: ({ row }) => formatDate(row.original.submittedAt),
    },
    {
      accessorKey: "lastWorkingDay",
      header: "Last working day",
      cell: ({ row }) => formatDate(row.original.lastWorkingDay),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={titleCase(row.original.status)} />,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) =>
        row.original.status === "PENDING" ? (
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setDecision({ id: row.original.id, name: employeeFullName(row.original.employee), kind: "DECLINED" })
              }
            >
              Decline
            </Button>
            <Button
              size="sm"
              onClick={() =>
                setDecision({ id: row.original.id, name: employeeFullName(row.original.employee), kind: "APPROVED" })
              }
            >
              Approve
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Resignations" description="Review resignation requests and notice periods." />

      <Card>
        <CardContent className="pt-6">
          <AsyncSection
            loading={loading}
            error={error}
            onRetry={refetch}
            loadingFallback={<TableSkeleton rows={6} columns={6} />}
          >
            {(data ?? []).length === 0 ? (
              <EmptyState icon={UserMinus} title="No resignation requests" />
            ) : (
              <DataTable columns={columns} data={data ?? []} searchColumn="employee" searchPlaceholder="Filter by name…" pageSize={10} />
            )}
          </AsyncSection>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!decision}
        onOpenChange={(open) => !open && setDecision(null)}
        title={decision?.kind === "APPROVED" ? "Approve this resignation?" : "Decline this resignation?"}
        description={
          decision
            ? `This will mark ${decision.name}'s resignation as ${decision.kind === "APPROVED" ? "approved" : "declined"}.`
            : ""
        }
        confirmLabel={decision?.kind === "APPROVED" ? "Approve" : "Decline"}
        variant={decision?.kind === "DECLINED" ? "destructive" : "default"}
        onConfirm={handleDecide}
      />
    </div>
  );
}
