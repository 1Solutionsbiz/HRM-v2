"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { formatINR } from "@/lib/format";
import { monthName } from "@/lib/api/payroll";
import { ApiError } from "@/lib/api-client";
import {
  getOperatingExpenses,
  upsertOperatingExpense,
  deleteOperatingExpense,
  OPERATING_EXPENSE_LABEL,
  type OperatingExpensesForPeriod,
  type CustomOperatingExpenseEntry,
} from "@/lib/api/operating-expenses";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CardSkeleton } from "@/components/hrm/loading-state";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function AmountEditor({
  label,
  amount,
  onSave,
}: {
  label: string;
  amount: number;
  onSave: (amount: number) => Promise<void>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(String(amount));
  const [saving, setSaving] = React.useState(false);

  function startEditing() {
    setDraft(String(amount));
    setEditing(true);
  }

  async function handleSave() {
    const value = Number(draft);
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    setSaving(true);
    try {
      await onSave(value);
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't save this expense.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEditing}
        className="group flex items-center gap-2 text-sm font-medium tabular-nums"
      >
        {formatINR(amount)}
        <Pencil className="text-muted-foreground size-3.5 opacity-0 group-hover:opacity-100" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="h-8 w-32 text-right"
        autoFocus
        disabled={saving}
        aria-label={`${label} amount`}
      />
      <Button size="icon" variant="ghost" className="size-8" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
      </Button>
    </div>
  );
}

function AddCustomExpenseRow({ onAdd }: { onAdd: (label: string, amount: number) => Promise<void> }) {
  const [adding, setAdding] = React.useState(false);
  const [label, setLabel] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  function reset() {
    setAdding(false);
    setLabel("");
    setAmount("");
  }

  async function handleSave() {
    const value = Number(amount);
    if (!label.trim()) {
      toast.error("Enter a name for this expense.");
      return;
    }
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    setSaving(true);
    try {
      await onAdd(label.trim(), value);
      reset();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't add this expense.");
    } finally {
      setSaving(false);
    }
  }

  if (!adding) {
    return (
      <Button variant="ghost" size="sm" className="mt-1 -ml-2" onClick={() => setAdding(true)}>
        <Plus />
        Add expense
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 py-2.5">
      <Input
        placeholder="Expense name…"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="h-8"
        autoFocus
        disabled={saving}
      />
      <Input
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="h-8 w-32 text-right"
        disabled={saving}
      />
      <Button size="icon" variant="ghost" className="size-8" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
      </Button>
      <Button size="icon" variant="ghost" className="size-8" onClick={reset} disabled={saving}>
        <X className="size-4" />
      </Button>
    </div>
  );
}

export function OperatingExpensesCard() {
  const today = new Date();
  const [periodMonth, setPeriodMonth] = React.useState(today.getMonth() + 1);
  const [periodYear, setPeriodYear] = React.useState(String(today.getFullYear()));
  const [data, setData] = React.useState<OperatingExpensesForPeriod | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    getOperatingExpenses(periodMonth, Number(periodYear))
      .then(setData)
      .finally(() => setLoading(false));
  }, [periodMonth, periodYear]);

  React.useEffect(() => {
    // Kicking off a fetch (an external system) on mount/period-change, not
    // deriving state from props - the sanctioned effect use case the lint
    // rule allows (same pattern as lib/use-async.ts).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleSaveStandard(category: OperatingExpensesForPeriod["entries"][number]["category"], amount: number) {
    await upsertOperatingExpense({ category, periodMonth, periodYear: Number(periodYear), amount });
    toast.success(`${OPERATING_EXPENSE_LABEL[category]} updated for ${monthName(periodMonth)} ${periodYear}`);
    load();
  }

  async function handleAddCustom(label: string, amount: number) {
    await upsertOperatingExpense({ category: "CUSTOM", label, periodMonth, periodYear: Number(periodYear), amount });
    toast.success(`Added "${label}" for ${monthName(periodMonth)} ${periodYear}`);
    load();
  }

  async function handleSaveCustom(entry: CustomOperatingExpenseEntry, amount: number) {
    await upsertOperatingExpense({
      category: "CUSTOM",
      label: entry.label,
      periodMonth,
      periodYear: Number(periodYear),
      amount,
    });
    toast.success(`${entry.label} updated for ${monthName(periodMonth)} ${periodYear}`);
    load();
  }

  async function handleDeleteCustom(entry: CustomOperatingExpenseEntry) {
    setDeletingId(entry.id);
    try {
      await deleteOperatingExpense(entry.id);
      toast.success(`Removed "${entry.label}"`);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't remove this expense.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Operating expenses</CardTitle>
          <CardDescription>Rent, utilities, and other recurring company costs.</CardDescription>
        </div>
        <div className="flex shrink-0 gap-2">
          <Select value={String(periodMonth)} onValueChange={(v) => setPeriodMonth(Number(v))}>
            <SelectTrigger className="h-8 w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {monthName(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            value={periodYear}
            onChange={(e) => setPeriodYear(e.target.value)}
            className="h-8 w-20"
          />
        </div>
      </CardHeader>
      <CardContent>
        {loading || !data ? (
          <CardSkeleton lines={4} />
        ) : (
          <div className="divide-y">
            {data.entries.map((entry) => (
              <div key={entry.category} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-sm">{OPERATING_EXPENSE_LABEL[entry.category]}</span>
                <AmountEditor
                  label={OPERATING_EXPENSE_LABEL[entry.category]}
                  amount={entry.amount}
                  onSave={(amount) => handleSaveStandard(entry.category, amount)}
                />
              </div>
            ))}
            {data.custom.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-sm">{entry.label}</span>
                <div className="flex items-center gap-1">
                  <AmountEditor
                    label={entry.label}
                    amount={entry.amount}
                    onSave={(amount) => handleSaveCustom(entry, amount)}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive size-8"
                    onClick={() => handleDeleteCustom(entry)}
                    disabled={deletingId === entry.id}
                  >
                    {deletingId === entry.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}

            <AddCustomExpenseRow onAdd={handleAddCustom} />

            <div className="flex items-center justify-between pt-3">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-sm font-semibold tabular-nums">{formatINR(data.total)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
