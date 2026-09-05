"use client";

import * as React from "react";
import { toast } from "sonner";
import { type ColumnDef } from "@tanstack/react-table";
import { useAsync } from "@/lib/use-async";
import { formatDate, formatINR, toDateOnlyString } from "@/lib/format";
import { ApiError } from "@/lib/api-client";
import { getCompanySalaries, reviseSalary, type SalaryStructure } from "@/lib/api/payroll";
import { employeeFullName, employeeInitials, titleCase } from "@/lib/api/employees";
import { PageHeader } from "@/components/hrm/page-header";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { TableSkeleton } from "@/components/hrm/loading-state";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

function todayISO() {
  return toDateOnlyString(new Date());
}

export default function SalaryManagementPage() {
  const { data, loading, error, refetch } = useAsync(getCompanySalaries);
  const [editing, setEditing] = React.useState<SalaryStructure | null>(null);
  const [draftAmount, setDraftAmount] = React.useState("");
  const [draftDate, setDraftDate] = React.useState(todayISO());
  const [draftReason, setDraftReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  function openEdit(record: SalaryStructure) {
    setEditing(record);
    setDraftAmount(String(record.currentAmount));
    setDraftDate(todayISO());
    setDraftReason("");
    setSaveError(null);
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    try {
      await reviseSalary(editing.employeeId, {
        newAmount: Number(draftAmount),
        effectiveDate: draftDate,
        reason: draftReason.trim() || undefined,
      });
      toast.success(
        `${employeeFullName(editing.employee)}'s salary updated to ${formatINR(Number(draftAmount))}`,
      );
      setEditing(null);
      refetch();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Couldn't save this revision. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const columns: ColumnDef<SalaryStructure>[] = [
    {
      id: "employee",
      accessorFn: (row) => employeeFullName(row.employee),
      header: "Employee",
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <Avatar className="size-7 shrink-0">
            <AvatarFallback className="text-[10px]">{employeeInitials(row.original.employee)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{employeeFullName(row.original.employee)}</p>
            <p className="text-muted-foreground truncate text-xs">
              {row.original.employee.designation?.title ?? "—"}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "department",
      accessorFn: (row) => row.employee.department?.name ?? "",
      header: "Department",
      cell: ({ row }) => row.original.employee.department?.name ?? "—",
    },
    {
      accessorKey: "currentAmount",
      header: "Current salary",
      cell: ({ row }) => <span className="tabular-nums">{formatINR(row.original.currentAmount)}</span>,
    },
    {
      accessorKey: "lastRevisedAt",
      header: "Last revised",
      cell: ({ row }) => (row.original.lastRevisedAt ? formatDate(row.original.lastRevisedAt) : "—"),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={titleCase(row.original.status)} />,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)}>
          Update
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Salary management" description="Manage employee compensation." />

      <Card>
        <CardContent className="pt-6">
          <AsyncSection
            loading={loading}
            error={error}
            onRetry={refetch}
            loadingFallback={<TableSkeleton rows={8} columns={5} />}
          >
            <DataTable columns={columns} data={data ?? []} searchColumn="department" searchPlaceholder="Filter by department…" pageSize={10} />
          </AsyncSection>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>Update salary</DialogTitle>
                <DialogDescription>
                  {employeeFullName(editing.employee)} · {editing.employee.designation?.title ?? "—"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {saveError && (
                  <Alert variant="destructive">
                    <AlertDescription>{saveError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="new-salary">New monthly salary (₹)</Label>
                  <Input
                    id="new-salary"
                    type="number"
                    min="0"
                    step="0.01"
                    value={draftAmount}
                    onChange={(e) => setDraftAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="effective-date">Effective date</Label>
                  <Input
                    id="effective-date"
                    type="date"
                    max={todayISO()}
                    value={draftDate}
                    onChange={(e) => setDraftDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason (optional)</Label>
                  <Textarea
                    id="reason"
                    placeholder="e.g. Annual increment, role change…"
                    value={draftReason}
                    onChange={(e) => setDraftReason(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving || !draftAmount}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
