"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { ApiError } from "@/lib/api-client";
import { toDateOnlyString } from "@/lib/format";
import { getExpenseCategories, submitExpenseClaim, uploadReceipt } from "@/lib/api/expenses";
import { PageHeader } from "@/components/hrm/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DropdownDatePicker } from "@/components/ui/date-picker";
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
  const [receiptUrl, setReceiptUrl] = React.useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = React.useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = React.useState(false);
  const [receiptError, setReceiptError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const ALLOWED_RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

  async function handleReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file after removing it
    if (!file) return;
    setReceiptError(null);
    if (!ALLOWED_RECEIPT_TYPES.includes(file.type)) {
      setReceiptError("Receipts must be a JPEG, PNG, WEBP, or PDF file.");
      return;
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      setReceiptError("Receipt must be smaller than 5 MB.");
      return;
    }
    setUploadingReceipt(true);
    try {
      const result = await uploadReceipt(file);
      setReceiptUrl(result.url);
      setReceiptFileName(file.name);
    } catch (err) {
      setReceiptError(err instanceof ApiError ? err.message : "Couldn't upload this receipt. Please try again.");
    } finally {
      setUploadingReceipt(false);
    }
  }

  function removeReceipt() {
    setReceiptUrl(null);
    setReceiptFileName(null);
    setReceiptError(null);
  }

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
        receiptUrl: receiptUrl ?? undefined,
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
              <div className="space-y-2 col-span-2">
                <Label>Date</Label>
                <DropdownDatePicker
                  value={date}
                  onChange={setDate}
                  fromYear={new Date().getFullYear() - 5}
                  className="max-w-xs"
                />
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
              <Label htmlFor="receipt-file">Receipt (optional)</Label>
              {receiptFileName ? (
                <div className="border-input flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <FileText className="text-muted-foreground size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{receiptFileName}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove receipt"
                    onClick={removeReceipt}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <label
                  htmlFor="receipt-file"
                  className="border-input hover:bg-accent flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-3 py-3 text-sm"
                >
                  {uploadingReceipt ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Paperclip className="text-muted-foreground size-4" />
                      Attach a receipt
                    </>
                  )}
                  <input
                    id="receipt-file"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    disabled={uploadingReceipt}
                    onChange={handleReceiptChange}
                  />
                </label>
              )}
              {receiptError ? (
                <p className="text-destructive text-xs">{receiptError}</p>
              ) : (
                <p className="text-muted-foreground text-xs">JPEG, PNG, WEBP, or PDF, up to 5 MB.</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting || uploadingReceipt || !effectiveCategoryId}>
                {submitting ? "Submitting…" : "Submit claim"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
