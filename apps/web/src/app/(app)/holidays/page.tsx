"use client";

import * as React from "react";
import { toast } from "sonner";
import { CalendarCheck, CalendarClock, Pencil, PartyPopper, Plus, Trash2 } from "lucide-react";
import { useAuthenticatedUser } from "@/lib/auth-context";
import { useAsync } from "@/lib/use-async";
import { ApiError } from "@/lib/api-client";
import { getHolidays, createHoliday, updateHoliday, deleteHoliday, type Holiday } from "@/lib/api/holidays";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/hrm/page-header";
import { StatCard } from "@/components/hrm/stat-card";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { ConfirmDialog } from "@/components/hrm/confirm-dialog";
import { StatGridSkeleton, TableSkeleton } from "@/components/hrm/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

interface HolidayFormState {
  name: string;
  date: Date | undefined;
}

export default function HolidaysPage() {
  const user = useAuthenticatedUser();
  const canManage = user.role === "admin" || user.role === "hr";
  const { data, loading, error, refetch } = useAsync(getHolidays);

  const [year, setYear] = React.useState<string>(String(new Date().getFullYear()));
  const [target, setTarget] = React.useState<Holiday | "new" | null>(null);
  const [form, setForm] = React.useState<HolidayFormState>({ name: "", date: undefined });
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Holiday | null>(null);

  const years = React.useMemo(() => {
    const set = new Set((data ?? []).map((h) => h.date.slice(0, 4)));
    set.add(String(new Date().getFullYear()));
    return Array.from(set).sort();
  }, [data]);

  const forYear = React.useMemo(
    () => (data ?? []).filter((h) => h.date.startsWith(year)).sort((a, b) => a.date.localeCompare(b.date)),
    [data, year],
  );

  const today = todayDateOnly();
  const thisMonthPrefix = today.slice(0, 7);
  const completed = forYear.filter((h) => h.date < today);
  const upcoming = forYear.filter((h) => h.date >= today);
  const thisMonth = forYear.filter((h) => h.date.startsWith(thisMonthPrefix));

  function openAdd() {
    setForm({ name: "", date: undefined });
    setSaveError(null);
    setTarget("new");
  }

  function openEdit(holiday: Holiday) {
    setForm({ name: holiday.name, date: new Date(holiday.date) });
    setSaveError(null);
    setTarget(holiday);
  }

  async function handleSave() {
    if (!target || !form.date) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = { name: form.name.trim(), date: form.date.toISOString().slice(0, 10) };
      if (target === "new") {
        await createHoliday(payload);
        toast.success(`${payload.name} added`);
      } else {
        await updateHoliday(target.id, payload);
        toast.success(`${payload.name} updated`);
      }
      setTarget(null);
      refetch();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Couldn't save this holiday. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteHoliday(deleteTarget.id);
      toast.success(`${deleteTarget.name} removed`);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't remove this holiday.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Holidays"
        description="Company holidays and celebrations."
        actions={
          <div className="flex items-center gap-2">
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canManage && (
              <Button size="sm" onClick={openAdd}>
                <Plus />
                Add holiday
              </Button>
            )}
          </div>
        }
      />

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={refetch}
        loadingFallback={<StatGridSkeleton count={4} />}
      >
        {data && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={`Completed (${year})`} value={String(completed.length)} icon={CalendarCheck} tone="success" />
            <StatCard label="This month" value={String(thisMonth.length)} icon={CalendarClock} />
            <StatCard label={`Upcoming (${year})`} value={String(upcoming.length)} icon={PartyPopper} tone="warning" />
            <StatCard label={`Total (${year})`} value={String(forYear.length)} />
          </div>
        )}
      </AsyncSection>

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={refetch}
        loadingFallback={<TableSkeleton rows={4} columns={3} />}
      >
        {forYear.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <EmptyState icon={PartyPopper} title="No holidays recorded for this year" />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {forYear.map((h) => {
              const isPast = h.date < today;
              return (
                <Card key={h.id}>
                  <CardContent className="flex items-start justify-between gap-3 pt-6">
                    <div className="min-w-0">
                      <p className="text-muted-foreground text-xs">{formatDate(h.date)}</p>
                      <p className="truncate text-sm font-semibold">{h.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatDate(h.date, { weekday: "long" })}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {isPast ? (
                        <Badge variant="secondary">Completed</Badge>
                      ) : canManage ? (
                        <div className="flex gap-1">
                          <Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => openEdit(h)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            aria-label="Delete"
                            onClick={() => setDeleteTarget(h)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="outline">Upcoming</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </AsyncSection>

      <Dialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{target === "new" ? "Add holiday" : "Edit holiday"}</DialogTitle>
            <DialogDescription>Company-wide - visible to every employee.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {saveError && (
              <Alert variant="destructive">
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="holiday-name">Name</Label>
              <Input
                id="holiday-name"
                placeholder="e.g. Diwali"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <DatePicker value={form.date} onChange={(date) => setForm((f) => ({ ...f, date }))} className="w-full" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.date}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remove this holiday?"
        description={deleteTarget ? `"${deleteTarget.name}" will no longer count toward attendance or leave calculations.` : ""}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
