"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Loader2, Pencil } from "lucide-react";
import { formatINR } from "@/lib/format";
import { monthName } from "@/lib/api/payroll";
import { ApiError } from "@/lib/api-client";
import {
  getOperatingExpenses,
  upsertOperatingExpense,
  OPERATING_EXPENSE_LABEL,
  type OperatingExpensesForPeriod,
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

function ExpenseRow({
  entry,
  periodMonth,
  periodYear,
  onSaved,
}: {
  entry: OperatingExpensesForPeriod["entries"][number];
  periodMonth: number;
  periodYear: number;
  onSaved: (amount: number) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(String(entry.amount));
  const [saving, setSaving] = React.useState(false);

  function startEditing() {
    setDraft(String(entry.amount));
    setEditing(true);
  }

  async function handleSave() {
    const amount = Number(draft);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    setSaving(true);
    try {
      await upsertOperatingExpense({ category: entry.category, periodMonth, periodYear, amount });
      onSaved(amount);
      setEditing(false);
      toast.success(`${OPERATING_EXPENSE_LABEL[entry.category]} updated for ${monthName(periodMonth)} ${periodYear}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't save this expense.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm">{OPERATING_EXPENSE_LABEL[entry.category]}</span>
      {editing ? (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-8 w-32 text-right"
            autoFocus
            disabled={saving}
          />
          <Button size="icon" variant="ghost" className="size-8" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={startEditing}
          className="group flex items-center gap-2 text-sm font-medium tabular-nums"
        >
          {formatINR(entry.amount)}
          <Pencil className="text-muted-foreground size-3.5 opacity-0 group-hover:opacity-100" />
        </button>
      )}
    </div>
  );
}

export function OperatingExpensesCard() {
  const today = new Date();
  const [periodMonth, setPeriodMonth] = React.useState(today.getMonth() + 1);
  const [periodYear, setPeriodYear] = React.useState(String(today.getFullYear()));
  const [data, setData] = React.useState<OperatingExpensesForPeriod | null>(null);
  const [loading, setLoading] = React.useState(true);

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
              <ExpenseRow
                key={entry.category}
                entry={entry}
                periodMonth={periodMonth}
                periodYear={Number(periodYear)}
                onSaved={(amount) =>
                  setData((prev) =>
                    prev
                      ? {
                          ...prev,
                          entries: prev.entries.map((e) => (e.category === entry.category ? { ...e, amount } : e)),
                          total: prev.entries.reduce(
                            (sum, e) => sum + (e.category === entry.category ? amount : e.amount),
                            0,
                          ),
                        }
                      : prev,
                  )
                }
              />
            ))}
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
