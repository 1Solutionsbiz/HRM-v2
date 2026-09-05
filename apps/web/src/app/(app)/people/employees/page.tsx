"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { useAsync } from "@/lib/use-async";
import { formatDate } from "@/lib/format";
import { getEmployeeDirectory } from "@/lib/mock/mock-api";
import type { DirectoryEmployee } from "@/lib/mock/hr-fixtures";
import { PageHeader } from "@/components/hrm/page-header";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { TableSkeleton } from "@/components/hrm/loading-state";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export default function EmployeesPage() {
  const { data, loading, error, refetch } = useAsync(getEmployeeDirectory);
  const [selected, setSelected] = React.useState<DirectoryEmployee | null>(null);

  const columns: ColumnDef<DirectoryEmployee>[] = [
    {
      accessorKey: "name",
      header: "Employee",
      cell: ({ row }) => (
        <button
          type="button"
          className="flex items-center gap-2.5 text-left hover:underline"
          onClick={() => setSelected(row.original)}
        >
          <Avatar className="size-7 shrink-0">
            <AvatarFallback className="text-[10px]">{row.original.avatarInitials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.original.name}</p>
            <p className="text-muted-foreground truncate text-xs">{row.original.empCode}</p>
          </div>
        </button>
      ),
    },
    { accessorKey: "department", header: "Department" },
    { accessorKey: "designation", header: "Designation" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
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

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent>
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    <AvatarFallback>{selected.avatarInitials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <SheetTitle>{selected.name}</SheetTitle>
                    <SheetDescription>{selected.designation}</SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              <div className="space-y-4 px-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-muted-foreground text-xs">Employee code</p>
                    <p className="font-medium">{selected.empCode}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Status</p>
                    <StatusBadge status={selected.status} />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Department</p>
                    <p className="font-medium">{selected.department}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Reporting manager</p>
                    <p className="font-medium">{selected.manager}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Date of joining</p>
                    <p className="font-medium">{formatDate(selected.doj)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Email</p>
                    <p className="truncate font-medium">{selected.email}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Phone</p>
                    <p className="font-medium">{selected.phone}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
