"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { ApiError } from "@/lib/api-client";
import {
  getLeaveBalances,
  getLeaveTypes,
  applyLeave,
  type LeaveDayType,
  type HalfDayPeriod,
} from "@/lib/api/leave";
import { PageHeader } from "@/components/hrm/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker, DateRangePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ApplyLeavePage() {
  const router = useRouter();
  const { data: balances } = useAsync(getLeaveBalances);
  const { data: leaveTypes } = useAsync(getLeaveTypes);

  const [leaveTypeId, setLeaveTypeId] = React.useState<string>("");
  const [dayType, setDayType] = React.useState<LeaveDayType>("FULL_DAY");
  const [halfDayPeriod, setHalfDayPeriod] = React.useState<HalfDayPeriod>("MORNING");
  const [singleDate, setSingleDate] = React.useState<Date>();
  const [range, setRange] = React.useState<{ from?: Date; to?: Date }>();
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // Derived rather than synced via effect: falls back to the first leave
  // type once the list loads, without a setState-in-effect render cascade.
  const effectiveLeaveTypeId = leaveTypeId || leaveTypes?.[0]?.id || "";
  const balance = balances?.find((b) => b.leaveTypeId === effectiveLeaveTypeId);
  const selectedType = leaveTypes?.find((t) => t.id === effectiveLeaveTypeId);

  function validate() {
    const next: Record<string, string> = {};
    if (dayType === "FULL_DAY") {
      if (!range?.from || !range?.to) next.date = "Select a start and end date.";
    } else {
      if (!singleDate) next.date = "Select a date.";
    }
    if (reason.trim().length < 5) next.reason = "Give a brief reason (5+ characters).";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!validate() || !effectiveLeaveTypeId) return;
    setSubmitting(true);
    try {
      const toISO = (d: Date) => d.toISOString().slice(0, 10);
      const startDate = dayType === "FULL_DAY" ? toISO(range!.from!) : toISO(singleDate!);
      const endDate = dayType === "FULL_DAY" ? toISO(range!.to!) : toISO(singleDate!);
      const request = await applyLeave({
        leaveTypeId: effectiveLeaveTypeId,
        startDate,
        endDate,
        dayType,
        halfDayPeriod: dayType === "HALF_DAY" ? halfDayPeriod : undefined,
        reason: reason.trim(),
      });
      toast.success(`Leave request ${request.code} submitted`, {
        description: "Your manager will review it shortly.",
      });
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
              <Label htmlFor="leave-type">Leave type</Label>
              <Select value={effectiveLeaveTypeId} onValueChange={setLeaveTypeId}>
                <SelectTrigger id="leave-type" className="w-full">
                  <SelectValue placeholder="Select a leave type" />
                </SelectTrigger>
                <SelectContent>
                  {(leaveTypes ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {balance && (
                <p className="text-muted-foreground text-xs">
                  {balance.remainingDays} of {balance.allocatedDays + balance.carriedOverDays} days remaining
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Duration</Label>
              <RadioGroup
                value={dayType}
                onValueChange={(v) => setDayType(v as LeaveDayType)}
                className="flex gap-4"
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="FULL_DAY" /> Full day
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="HALF_DAY" /> Half day
                </label>
              </RadioGroup>
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
              <Label>{dayType === "FULL_DAY" ? "Dates" : "Date"}</Label>
              {dayType === "FULL_DAY" ? (
                <DateRangePicker value={range} onChange={setRange} />
              ) : (
                <DatePicker value={singleDate} onChange={setSingleDate} />
              )}
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

            {balance && balance.remainingDays <= 0 && (
              <Alert variant="warning">
                <Info />
                <AlertDescription>
                  You have no {(selectedType?.name ?? "leave").toLowerCase()} remaining. You can
                  still submit - your manager will review it as an exception.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting || !effectiveLeaveTypeId}>
                {submitting ? "Submitting…" : "Submit request"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
