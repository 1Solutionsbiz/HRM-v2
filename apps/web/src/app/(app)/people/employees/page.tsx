"use client";

import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { useAsync } from "@/lib/use-async";
import { getEmployees, employeeFullName, employeeInitials, titleCase, type EmployeeListItem } from "@/lib/api/employees";
import { PageHeader } from "@/components/hrm/page-header";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { TableSkeleton } from "@/components/hrm/loading-state";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function EmployeesPage() {
  const { data, loading, error, refetch } = useAsync(getEmployees);

  const columns: ColumnDef<EmployeeListItem>[] = [
    {
      accessorKey: "name",
      accessorFn: (row) => employeeFullName(row),
      id: "name",
      header: "Employee",
      cell: ({ row }) => (
        <Link
          href={`/people/employees/${row.original.id}`}
          className="flex items-center gap-2.5 text-left hover:underline"
        >
          <Avatar className="size-7 shrink-0">
            <AvatarFallback className="text-[10px]">{employeeInitials(row.original)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{employeeFullName(row.original)}</p>
            <p className="text-muted-foreground truncate text-xs">{row.original.employeeCode}</p>
          </div>
        </Link>
      ),
    },
    {
      id: "department",
      accessorFn: (row) => row.department?.name ?? "",
      header: "Department",
      cell: ({ row }) => row.original.department?.name ?? "—",
    },
    {
      id: "designation",
      accessorFn: (row) => row.designation?.title ?? "",
      header: "Designation",
      cell: ({ row }) => row.original.designation?.title ?? "—",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={titleCase(row.original.status)} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description={data ? `${data.length} employees across the company.` : "The full employee directory."}
      />

      <Card>
        <CardContent className="pt-6">
          <AsyncSection
            loading={loading}
            error={error}
            onRetry={refetch}
            loadingFallback={<TableSkeleton rows={8} columns={4} />}
          >
            <DataTable
              columns={columns}
              data={data ?? []}
              searchColumn="department"
              searchPlaceholder="Filter by department…"
              emptyTitle="No employees found"
              pageSize={10}
            />
          </AsyncSection>
        </CardContent>
      </Card>
    </div>
  );
}
