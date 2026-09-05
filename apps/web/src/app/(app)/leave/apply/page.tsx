"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAsync } from "@/lib/use-async";
import { getLeaveBalances, applyLeave } from "@/lib/mock/mock-api";
import { leaveTypes } from "@/lib/mock/fixtures";
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
import { Info } from "lucide-react";

export default function ApplyLeavePage() {
  const router = useRouter();
  const { data: balances } = useAsync(getLeaveBalances);

  const [type, setType] = React.useState<string>(leaveTypes[0]);
  const [dayType, setDayType] = React.useState<"Full Day" | "Half Day">("Full Day");
  const [singleDate, setSingleDate] = React.useState<Date>();
  const [range, setRange] = React.useState<{ from?: Date; to?: Date }>();
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const balance = balances?.find((b) => b.type === type);

  function validate() {
    const next: Record<string, string> = {};
    if (dayType === "Full Day") {
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
    if (!validate()) return;
    setSubmitting(true);
    try {
      const toISO = (d: Date) => d.toISOString().slice(0, 10);
      const startDate = dayType === "Full Day" ? toISO(range!.from!) : toISO(singleDate!);
      const endDate = dayType === "Full Day" ? toISO(range!.to!) : toISO(singleDate!);
      const request = await applyLeave({ type, startDate, endDate, dayType, reason: reason.trim() });
      toast.success(`Leave request ${request.id} submitted`, {
        description: "Rahul Verma will review it shortly.",
      });
      router.push("/leave");
    } catch {
      toast.error("Couldn't submit your request. Please try again.");
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
            <div className="space-y-2">
              <Label htmlFor="leave-type">Leave type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="leave-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {balance && (
                <p className="text-muted-foreground text-xs">
                  {balance.total - balance.used} of {balance.total} days remaining
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Duration</Label>
              <RadioGroup
                value={dayType}
                onValueChange={(v) => setDayType(v as "Full Day" | "Half Day")}
                className="flex gap-4"
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="Full Day" /> Full day
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="Half Day" /> Half day
                </label>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>{dayType === "Full Day" ? "Dates" : "Date"}</Label>
              {dayType === "Full Day" ? (
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

            {balance && balance.total - balance.used <= 0 && (
              <Alert variant="warning">
                <Info />
                <AlertDescription>
                  You have no {type.toLowerCase()} remaining. You can still submit - your manager
                  will review it as an exception.
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
