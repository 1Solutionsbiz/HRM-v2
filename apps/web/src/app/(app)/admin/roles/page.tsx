"use client";

import * as React from "react";
import { toast } from "sonner";
import { type ColumnDef } from "@tanstack/react-table";
import { ShieldCheck } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { ApiError } from "@/lib/api-client";
import { getEmployeeRoles, getRolePermissions, setEmployeeRole, type EmployeeRoleRow } from "@/lib/api/admin";
import { ROLES, ROLE_LABELS, type Role } from "@/types/role";
import { PageHeader } from "@/components/hrm/page-header";
import { ConfirmDialog } from "@/components/hrm/confirm-dialog";
import { AsyncSection } from "@/components/hrm/async-section";
import { CardSkeleton, TableSkeleton } from "@/components/hrm/loading-state";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function RolesPermissionsPage() {
  const { data, loading, error, refetch } = useAsync(getEmployeeRoles);
  const permissions = useAsync(getRolePermissions);
  const [pendingChange, setPendingChange] = React.useState<{ row: EmployeeRoleRow; newRole: Role } | null>(null);

  async function handleConfirm() {
    if (!pendingChange) return;
    try {
      await setEmployeeRole(pendingChange.row.employeeId, pendingChange.newRole);
      toast.success(`${pendingChange.row.name} is now ${ROLE_LABELS[pendingChange.newRole]}`);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't change this employee's role.");
      throw err;
    }
  }

  const columns: ColumnDef<EmployeeRoleRow>[] = [
    {
      accessorKey: "name",
      header: "Employee",
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium">{row.original.name}</p>
          <p className="text-muted-foreground text-xs">{row.original.email}</p>
        </div>
      ),
    },
    { accessorKey: "department", header: "Department" },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) =>
        row.original.role ? (
          <Select
            value={row.original.role}
            onValueChange={(value) => setPendingChange({ row: row.original, newRole: value as Role })}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-muted-foreground text-xs">No role assigned</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Roles & permissions" description="Assign roles and review what each one can access." />

      <AsyncSection
        loading={permissions.loading}
        error={permissions.error}
        onRetry={permissions.refetch}
        loadingFallback={<CardSkeleton lines={4} />}
      >
        {permissions.data && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((r) => {
              const perms = permissions.data![r];
              return (
                <Card key={r}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-semibold">{ROLE_LABELS[r]}</CardTitle>
                    <ShieldCheck className="text-muted-foreground size-4" />
                  </CardHeader>
                  <CardContent>
                    <ul className="text-muted-foreground space-y-1.5 text-xs">
                      {perms.map((p) => (
                        <li key={p}>· {p}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </AsyncSection>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Employee role assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncSection
            loading={loading}
            error={error}
            onRetry={refetch}
            loadingFallback={<TableSkeleton rows={8} columns={3} />}
          >
            <DataTable
              columns={columns}
              data={data ?? []}
              searchColumn="name"
              searchPlaceholder="Search by name…"
              pageSize={10}
            />
          </AsyncSection>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!pendingChange}
        onOpenChange={(open) => !open && setPendingChange(null)}
        title="Change this employee's role?"
        description={
          pendingChange
            ? `${pendingChange.row.name} will become ${ROLE_LABELS[pendingChange.newRole]}. This changes what they can see and do across the whole system.`
            : ""
        }
        confirmLabel="Change role"
        variant={pendingChange?.newRole === "admin" ? "destructive" : "default"}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
