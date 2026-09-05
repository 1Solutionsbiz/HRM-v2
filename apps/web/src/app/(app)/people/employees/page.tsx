"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { useAsync } from "@/lib/use-async";
import { getEmployees, employeeFullName, employeeInitials, titleCase, type EmployeeListItem } from "@/lib/api/employees";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/hrm/page-header";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { TableSkeleton } from "@/components/hrm/loading-state";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function EmployeeCell({ employee }: { employee: EmployeeListItem }) {
  return (
    <Link
      href={`/people/employees/${employee.id}`}
      className="flex items-center gap-2.5 text-left hover:underline"
    >
      <Avatar className="size-7 shrink-0">
        <AvatarFallback className="text-[10px]">{employeeInitials(employee)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{employeeFullName(employee)}</p>
        <p className="text-muted-foreground truncate text-xs">{employee.employeeCode}</p>
      </div>
    </Link>
  );
}

export default function EmployeesPage() {
  const { data, loading, error, refetch } = useAsync(getEmployees);

  const active = React.useMemo(() => (data ?? []).filter((e) => e.status === "ACTIVE"), [data]);
  const past = React.useMemo(
    () =>
      (data ?? [])
        .filter((e) => e.status === "INACTIVE")
        // Most recently departed first; employees with no recorded exit
        // date (legacy gaps) sort to the end rather than the top.
        .sort((a, b) => (b.dateOfExit ?? "").localeCompare(a.dateOfExit ?? "")),
    [data],
  );

  const activeColumns: ColumnDef<EmployeeListItem>[] = [
    {
      accessorKey: "name",
      accessorFn: (row) => employeeFullName(row),
      id: "name",
      header: "Employee",
      cell: ({ row }) => <EmployeeCell employee={row.original} />,
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

  const pastColumns: ColumnDef<EmployeeListItem>[] = [
    {
      accessorKey: "name",
      accessorFn: (row) => employeeFullName(row),
      id: "name",
      header: "Employee",
      cell: ({ row }) => <EmployeeCell employee={row.original} />,
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
      accessorKey: "dateOfExit",
      header: "Date left",
      cell: ({ row }) => (row.original.dateOfExit ? formatDate(row.original.dateOfExit) : "—"),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description={data ? `${active.length} active employees across the company.` : "The full employee directory."}
      />

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="past">Past Employees</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <AsyncSection
                loading={loading}
                error={error}
                onRetry={refetch}
                loadingFallback={<TableSkeleton rows={8} columns={4} />}
              >
                <DataTable
                  columns={activeColumns}
                  data={active}
                  searchColumn="department"
                  searchPlaceholder="Filter by department…"
                  emptyTitle="No active employees found"
                  pageSize={10}
                />
              </AsyncSection>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="past" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <AsyncSection
                loading={loading}
                error={error}
                onRetry={refetch}
                loadingFallback={<TableSkeleton rows={8} columns={4} />}
              >
                <DataTable
                  columns={pastColumns}
                  data={past}
                  searchColumn="department"
                  searchPlaceholder="Filter by department…"
                  emptyTitle="No past employees"
                  pageSize={10}
                />
              </AsyncSection>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
