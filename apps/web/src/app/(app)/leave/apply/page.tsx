"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { ApiError } from "@/lib/api-client";
import { toDateOnlyString } from "@/lib/format";
import {
  getLeaveBalances,
  applyLeave,
  type LeaveDayType,
  type HalfDayPeriod,
} from "@/lib/api/leave";
import { PageHeader } from "@/components/hrm/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownDatePicker } from "@/components/ui/date-picker";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const DURATION_LABELS: Record<LeaveDayType, string> = {
  FULL_DAY: "Full day",
  HALF_DAY: "Half day",
  SHORT_LEAVE: "Short leave",
};

export default function ApplyLeavePage() {
  const router = useRouter();
  const { data: balances } = useAsync(getLeaveBalances);

  const [dayType, setDayType] = React.useState<LeaveDayType>("FULL_DAY");
  const [halfDayPeriod, setHalfDayPeriod] = React.useState<HalfDayPeriod>("MORNING");
  const [date, setDate] = React.useState<Date>();
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const monthlyBudget = balances?.find((b) => b.leaveTypeKey === "monthly-budget");

  function validate() {
    const next: Record<string, string> = {};
    if (!date) next.date = "Select a date.";
    if (reason.trim().length < 5) next.reason = "Give a brief reason (5+ characters).";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const dateString = toDateOnlyString(date!);
      const request = await applyLeave({
        startDate: dateString,
        endDate: dateString,
        dayType,
        halfDayPeriod: dayType === "HALF_DAY" ? halfDayPeriod : undefined,
        reason: reason.trim(),
      });
      if (request.autoConvertedToLossOfPay) {
        toast.success(`Leave request ${request.code} submitted as Loss of Pay`, {
          description:
            "This exceeds your free monthly leave allowance, so it was recorded as Loss of Pay (salary deduction) instead.",
        });
      } else {
        toast.success(`Leave request ${request.code} submitted`, {
          description: "Your manager will review it shortly.",
        });
      }
      router.push("/leave");
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Couldn't submit your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader title="Apply leave" description="Submit a new leave request for approval." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leave details</CardTitle>
          <CardDescription>Fields marked are required.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Duration</Label>
              <RadioGroup
                value={dayType}
                onValueChange={(v) => setDayType(v as LeaveDayType)}
                className="flex gap-4"
              >
                {(Object.keys(DURATION_LABELS) as LeaveDayType[]).map((type) => (
                  <label key={type} className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value={type} /> {DURATION_LABELS[type]}
                  </label>
                ))}
              </RadioGroup>
              {monthlyBudget && (
                <p className="text-muted-foreground text-xs">
                  {monthlyBudget.remainingDays} of {monthlyBudget.allocatedDays} day free this month
                </p>
              )}
            </div>

            {dayType === "HALF_DAY" && (
              <div className="space-y-2">
                <Label>Which half</Label>
                <RadioGroup
                  value={halfDayPeriod}
                  onValueChange={(v) => setHalfDayPeriod(v as HalfDayPeriod)}
                  className="flex gap-4"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="MORNING" /> Morning
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="AFTERNOON" /> Afternoon
                  </label>
                </RadioGroup>
              </div>
            )}

            <div className="space-y-2">
              <Label>Date</Label>
              <DropdownDatePicker
                value={date}
                onChange={setDate}
                fromYear={new Date().getFullYear() - 1}
                toYear={new Date().getFullYear() + 2}
                className="max-w-xs"
              />
              {errors.date && <p className="text-destructive text-xs">{errors.date}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                placeholder="e.g. Family function, medical appointment…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
              {errors.reason && <p className="text-destructive text-xs">{errors.reason}</p>}
            </div>

            {monthlyBudget && monthlyBudget.remainingDays <= 0 && (
              <Alert variant="warning">
                <Info />
                <AlertDescription>
                  You have no free leave remaining this month. Submitting will be recorded as
                  Loss of Pay (salary deduction).
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit request"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
