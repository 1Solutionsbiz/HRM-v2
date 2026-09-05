"use client";

import * as React from "react";
import { toast } from "sonner";
import { type ColumnDef } from "@tanstack/react-table";
import { useAsync } from "@/lib/use-async";
import { formatDate, formatINR } from "@/lib/format";
import { getSalaryRecords } from "@/lib/mock/mock-api";
import type { SalaryRecord } from "@/lib/mock/hr-fixtures";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function SalaryManagementPage() {
  const { data, loading, error, refetch } = useAsync(getSalaryRecords);
  const [editing, setEditing] = React.useState<SalaryRecord | null>(null);
  const [draftAmount, setDraftAmount] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  function openEdit(record: SalaryRecord) {
    setEditing(record);
    setDraftAmount(String(record.currentSalary));
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 500));
    setSaving(false);
    setEditing(null);
    toast.success(`${editing.employeeName}'s salary updated to ${formatINR(Number(draftAmount))}`, {
      description: "This is a UI preview - it isn't persisted anywhere yet.",
    });
    refetch();
  }

  const columns: ColumnDef<SalaryRecord>[] = [
    {
      accessorKey: "employeeName",
      header: "Employee",
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <Avatar className="size-7 shrink-0">
            <AvatarFallback className="text-[10px]">{row.original.avatarInitials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.original.employeeName}</p>
            <p className="text-muted-foreground truncate text-xs">{row.original.designation}</p>
          </div>
        </div>
      ),
    },
    { accessorKey: "department", header: "Department" },
    {
      accessorKey: "currentSalary",
      header: "Current salary",
      cell: ({ row }) => <span className="tabular-nums">{formatINR(row.original.currentSalary)}</span>,
    },
    {
      accessorKey: "lastRevision",
      header: "Last revised",
      cell: ({ row }) => formatDate(row.original.lastRevision),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
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
                  {editing.employeeName} · {editing.designation}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="new-salary">New monthly salary (₹)</Label>
                <Input
                  id="new-salary"
                  type="number"
                  value={draftAmount}
                  onChange={(e) => setDraftAmount(e.target.value)}
                />
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
