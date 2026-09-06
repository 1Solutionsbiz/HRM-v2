"use client";

import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, Download, Plus, Search } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { ApiError } from "@/lib/api-client";
import {
  getEmployees,
  employeeFullName,
  employeeInitials,
  type EmployeeListItem,
} from "@/lib/api/employees";
import {
  getEmployeeSalary,
  getEmployeePayslips,
  generatePayslip,
  markPayslipPaid,
  monthName,
  type Payslip,
  type PayslipLineItemInput,
} from "@/lib/api/payroll";
import { formatDate, formatINR } from "@/lib/format";
import { downloadPayslipPdf } from "@/lib/payslip-pdf";
import { PageHeader } from "@/components/hrm/page-header";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { EmployeePicker } from "@/components/hrm/employee-picker";
import { PayslipDocument } from "@/components/hrm/payslip-document";
import { PayslipCardGrid } from "@/components/hrm/payslip-card-grid";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * The real legacy earnings breakup (reverse-engineered from
 * salary_template.php, verified byte-for-byte against a real issued
 * payslip - see PROJECT_STATUS.md's data-migration notes), not an invented
 * percentage split. Leave/Late deductions have no formula - they're
 * whatever actually happened that month - so they default to 0 and are
 * dropped from the payload if left there (the backend requires every
 * submitted line item's amount to be positive).
 */
function computeDefaultEarnings(salary: number): { label: string; amount: number }[] {
  const round = (n: number) => Math.round(n * 100) / 100;
  const basic = round(salary * 0.4);
  const hra = round(basic * 0.5);
  const medical = 800;
  const conveyance = 1200;
  const specialAllowance = round(salary - (basic + medical + hra + conveyance));
  return [
    { label: "Basic Salary", amount: basic },
    { label: "HRA", amount: hra },
    { label: "Medical Allowance", amount: medical },
    { label: "Conveyance Allowance", amount: conveyance },
    { label: "Special Allowance", amount: Math.max(0, specialAllowance) },
  ];
}

interface DraftRow {
  label: string;
  amount: string;
}

function GeneratePayslipDialog({
  employee,
  currentSalary,
  onClose,
  onGenerated,
}: {
  employee: EmployeeListItem;
  currentSalary: number | null;
  onClose: () => void;
  onGenerated: () => void;
}) {
  const today = new Date();
  const [periodMonth, setPeriodMonth] = React.useState(String(today.getMonth() + 1));
  const [periodYear, setPeriodYear] = React.useState(String(today.getFullYear()));
  const [earnings, setEarnings] = React.useState<DraftRow[]>(() =>
    (currentSalary ? computeDefaultEarnings(currentSalary) : []).map((e) => ({
      label: e.label,
      amount: String(e.amount),
    })),
  );
  const [leaveDeduction, setLeaveDeduction] = React.useState("0");
  const [lateDeduction, setLateDeduction] = React.useState("0");
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const grossTotal = earnings.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  async function handleGenerate() {
    setSaving(true);
    setSaveError(null);
    try {
      const lineItems: PayslipLineItemInput[] = earnings
        .filter((r) => Number(r.amount) > 0)
        .map((r) => ({ type: "EARNING", label: r.label, amount: Number(r.amount) }));
      if (Number(leaveDeduction) > 0) {
        lineItems.push({ type: "DEDUCTION", label: "Leave Deduction", amount: Number(leaveDeduction) });
      }
      if (Number(lateDeduction) > 0) {
        lineItems.push({ type: "DEDUCTION", label: "Late Deduction", amount: Number(lateDeduction) });
      }
      if (lineItems.length === 0) {
        setSaveError("Enter at least one earning amount.");
        return;
      }
      await generatePayslip(employee.id, {
        periodMonth: Number(periodMonth),
        periodYear: Number(periodYear),
        lineItems,
      });
      toast.success(`Payslip generated for ${monthName(Number(periodMonth))} ${periodYear}`);
      onClose();
      onGenerated();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Couldn't generate this payslip. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate payslip</DialogTitle>
          <DialogDescription>
            {employeeFullName(employee)} · {employee.employeeCode}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
          {!currentSalary && (
            <Alert>
              <AlertDescription>
                No salary structure on file for this employee - earnings default to 0. Enter amounts manually below.
              </AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={periodMonth} onValueChange={setPeriodMonth}>
                <SelectTrigger className="w-full">
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="period-year">Year</Label>
              <Input
                id="period-year"
                type="number"
                value={periodYear}
                onChange={(e) => setPeriodYear(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Earnings</Label>
            <div className="space-y-2 rounded-md border p-3">
              {earnings.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  No salary on file - use &quot;Salary management&quot; to set one, or this payslip will have no earnings.
                </p>
              ) : (
                earnings.map((row, i) => (
                  <div key={row.label} className="flex items-center justify-between gap-3">
                    <span className="text-sm">{row.label}</span>
                    <Input
                      type="number"
                      className="w-32"
                      value={row.amount}
                      onChange={(e) =>
                        setEarnings((prev) =>
                          prev.map((r, idx) => (idx === i ? { ...r, amount: e.target.value } : r)),
                        )
                      }
                    />
                  </div>
                ))
              )}
              <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
                <span>Gross</span>
                <span>{formatINR(grossTotal)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Deductions (optional)</Label>
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">Leave Deduction</span>
                <Input
                  type="number"
                  className="w-32"
                  value={leaveDeduction}
                  onChange={(e) => setLeaveDeduction(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">Late Deduction</span>
                <Input
                  type="number"
                  className="w-32"
                  value={lateDeduction}
                  onChange={(e) => setLateDeduction(e.target.value)}
                />
              </div>
              <p className="text-muted-foreground text-xs">Left at 0, a deduction won&apos;t appear on the payslip.</p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={saving}>
            {saving ? "Generating…" : "Generate payslip"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmployeePayslipsView({ employee }: { employee: EmployeeListItem }) {
  const salary = useAsync(() => getEmployeeSalary(employee.id), [employee.id]);
  const payslips = useAsync(() => getEmployeePayslips(employee.id), [employee.id]);
  const [generateOpen, setGenerateOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Payslip | null>(null);
  const [marking, setMarking] = React.useState(false);

  function handleDownload(p: Payslip) {
    downloadPayslipPdf(p);
    toast.success(`Downloaded ${monthName(p.periodMonth)} ${p.periodYear} payslip`);
  }

  async function handleMarkPaid(p: Payslip) {
    setMarking(true);
    try {
      const updated = await markPayslipPaid(p.id);
      toast.success(`${monthName(p.periodMonth)} ${p.periodYear} marked as paid`);
      setSelected(updated);
      payslips.refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't mark this payslip as paid.");
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="size-9 shrink-0">
              <AvatarFallback className="text-xs">{employeeInitials(employee)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{employeeFullName(employee)}</p>
              <p className="text-muted-foreground text-xs">
                {employee.employeeCode} · {employee.designation?.title ?? "—"} · {employee.department?.name ?? "—"}
                {salary.data?.structure && ` · Current salary ${formatINR(salary.data.structure.currentAmount)}`}
              </p>
            </div>
          </div>
          {employee.status === "ACTIVE" && (
            <Button size="sm" onClick={() => setGenerateOpen(true)}>
              <Plus />
              Generate payslip
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payslip history</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncSection
            loading={payslips.loading}
            error={payslips.error}
            onRetry={payslips.refetch}
            loadingFallback={<CardSkeleton lines={4} />}
          >
            <PayslipCardGrid payslips={payslips.data ?? []} onOpen={setSelected} onDownload={handleDownload} />
          </AsyncSection>
        </CardContent>
      </Card>

      {generateOpen && (
        <GeneratePayslipDialog
          employee={employee}
          currentSalary={salary.data?.structure?.currentAmount ?? null}
          onClose={() => setGenerateOpen(false)}
          onGenerated={payslips.refetch}
        />
      )}

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {monthName(selected.periodMonth)} {selected.periodYear}
                </SheetTitle>
                <SheetDescription>
                  {selected.status === "PAID"
                    ? selected.paidAt
                      ? `Paid on ${formatDate(selected.paidAt)}`
                      : "Paid"
                    : "Processing"}
                </SheetDescription>
              </SheetHeader>
              <div className="px-4">
                <PayslipDocument payslip={selected} />
              </div>
              <SheetFooter className="flex-row">
                <Button variant="outline" onClick={() => handleDownload(selected)}>
                  <Download />
                  Download PDF
                </Button>
                {selected.status !== "PAID" && (
                  <Button onClick={() => handleMarkPaid(selected)} disabled={marking}>
                    <CheckCircle2 />
                    {marking ? "Marking…" : "Mark as paid"}
                  </Button>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function AdminPayslipsPage() {
  // Deliberately not filtered to active-only: HR needs to look up a past
  // employee's payslip history too (that data is real and imported - see
  // PROJECT_STATUS.md - but was unreachable through this search before).
  // Generating a *new* payslip for someone no longer employed is blocked
  // separately, inside EmployeePayslipsView.
  const { data: employees } = useAsync(getEmployees);
  const [selected, setSelected] = React.useState<EmployeeListItem | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payslips"
        description="Generate payslips and review any employee's history."
        actions={<EmployeePicker employees={employees ?? []} onSelect={setSelected} />}
      />

      {selected ? (
        <EmployeePayslipsView employee={selected} />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <EmptyState icon={Search} title="Search for an employee" description="Pick someone to view or generate their payslips." />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
