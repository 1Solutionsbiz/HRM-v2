"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAsync } from "@/lib/use-async";
import { ApiError } from "@/lib/api-client";
import { toDateOnlyString } from "@/lib/format";
import { getExpenseCategories, submitExpenseClaim } from "@/lib/api/expenses";
import { PageHeader } from "@/components/hrm/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function AddExpensePage() {
  const router = useRouter();
  const { data: categories } = useAsync(getExpenseCategories);

  const [categoryId, setCategoryId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const [description, setDescription] = React.useState("");
  const [receiptUrl, setReceiptUrl] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // Derived rather than synced via effect - same pattern as Leave's apply
  // form, falls back to the first category once the list loads.
  const effectiveCategoryId = categoryId || categories?.[0]?.id || "";

  function validate() {
    const next: Record<string, string> = {};
    const amountNum = Number(amount);
    if (!amount || Number.isNaN(amountNum) || amountNum <= 0) next.amount = "Enter a valid amount.";
    if (!date) next.date = "Select a date.";
    if (description.trim().length < 5) next.description = "Add a short description (5+ characters).";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!validate() || !effectiveCategoryId) return;
    setSubmitting(true);
    try {
      const claim = await submitExpenseClaim({
        categoryId: effectiveCategoryId,
        amount: Number(amount),
        expenseDate: toDateOnlyString(date!),
        description: description.trim(),
        receiptUrl: receiptUrl.trim() || undefined,
      });
      toast.success(`Expense claim ${claim.code} submitted`, {
        description: "It's now pending approval.",
      });
      router.push("/expenses");
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Couldn't submit your claim. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader title="Add expense" description="Submit a new reimbursement claim." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expense details</CardTitle>
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
              <Label htmlFor="category">Category</Label>
              <Select value={effectiveCategoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="category" className="w-full">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {(categories ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (₹)</Label>
                <Input
                  id="amount"
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                {errors.amount && <p className="text-destructive text-xs">{errors.amount}</p>}
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <DatePicker value={date} onChange={setDate} className="w-full" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="e.g. Cab fare for client visit"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
              {errors.description && (
                <p className="text-destructive text-xs">{errors.description}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="receipt-url">Receipt URL (optional)</Label>
              <Input
                id="receipt-url"
                type="url"
                placeholder="https://…"
                value={receiptUrl}
                onChange={(e) => setReceiptUrl(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                There&apos;s no file storage yet, so paste a link to your receipt instead of attaching a file.
              </p>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting || !effectiveCategoryId}>
                {submitting ? "Submitting…" : "Submit claim"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
