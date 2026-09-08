"use client";

import * as React from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";
import { nominateEmployeeOfTheMonth } from "@/lib/api/employee-of-the-month";
import { employeeInitials, employeeFullName, type EmployeeListItem } from "@/lib/api/employees";
import { EmployeePicker } from "@/components/hrm/employee-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function NominateEmployeeOfTheMonthDialog({
  employees,
  onClose,
  onNominated,
}: {
  employees: EmployeeListItem[];
  onClose: () => void;
  onNominated: () => void;
}) {
  const [selected, setSelected] = React.useState<EmployeeListItem | null>(null);
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const active = React.useMemo(() => employees.filter((e) => e.status === "ACTIVE"), [employees]);

  async function handleSubmit() {
    if (!selected) {
      setError("Pick an employee.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await nominateEmployeeOfTheMonth({ employeeId: selected.id, note: note.trim() || undefined });
      toast.success(`${employeeFullName(selected)} is this month's employee of the month`);
      onNominated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this nomination.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nominate employee of the month</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label>Employee</Label>
            {selected ? (
              <button
                type="button"
                className="hover:bg-accent flex w-full items-center gap-2.5 rounded-md border p-2 text-left"
                onClick={() => setSelected(null)}
              >
                <Avatar className="size-8 shrink-0">
                  {selected.avatarUrl && <AvatarImage src={selected.avatarUrl} alt="" />}
                  <AvatarFallback className="text-xs">{employeeInitials(selected)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{employeeFullName(selected)}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {selected.employeeCode} · {selected.department?.name ?? "—"}
                  </p>
                </div>
              </button>
            ) : (
              <EmployeePicker employees={active} onSelect={setSelected} />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="eom-note">Note (optional)</Label>
            <Textarea
              id="eom-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What made this a standout month?"
              rows={3}
              maxLength={500}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            Nominating again this month replaces the current pick.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !selected}>
            {saving ? "Saving…" : "Nominate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
