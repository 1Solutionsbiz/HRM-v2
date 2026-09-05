"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, Wallet } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { getMyPayslips, monthName, type Payslip, type PayslipEmployee } from "@/lib/api/payroll";
import { titleCase } from "@/lib/api/employees";
import { formatDate, formatINR } from "@/lib/format";
import { PageHeader } from "@/components/hrm/page-header";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { TableSkeleton } from "@/components/hrm/loading-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";

// The legal entity that actually issues payslips ("Expetize Private
// Limited") is distinct from the company brand (CompanySettings holds
// "1Solutions") — confirmed against a real legacy-issued payslip PDF and
// the legacy app's own PHP template, which hardcodes this block the same
// way (it isn't pulled from a company table there either). No
// CompanySettings field exists for CIN/registration number, so this stays
// a constant here rather than a half-modeled schema addition.
const PAYSLIP_ISSUER = {
  name: "Expetize Private Limited",
  addressLine1: "47, Vijay Block, Ground Floor, Laxmi Nagar,",
  addressLine2: "Delhi - 110092",
  cin: "U74999DL2016PTC307712",
  registrationNumber: "307712",
};

function PayslipDocument({ payslip }: { payslip: Payslip }) {
  const earnings = payslip.lineItems.filter((i) => i.type === "EARNING");
  const deductions = payslip.lineItems.filter((i) => i.type === "DEDUCTION");
  const totalEarning = earnings.reduce((sum, i) => sum + i.amount, 0);
  const totalDeduction = deductions.reduce((sum, i) => sum + i.amount, 0);
  const employee: PayslipEmployee | null = payslip.employee;

  return (
    <div className="space-y-4 rounded-lg border p-5">
      <div className="space-y-1 text-center">
        <p className="text-lg font-bold">{PAYSLIP_ISSUER.name}</p>
        <p className="text-muted-foreground text-xs">
          {PAYSLIP_ISSUER.addressLine1}
          <br />
          {PAYSLIP_ISSUER.addressLine2}
        </p>
        <p className="text-muted-foreground text-[11px]">
          CIN : {PAYSLIP_ISSUER.cin} | Registration Number : {PAYSLIP_ISSUER.registrationNumber}
        </p>
      </div>

      <p className="text-center text-sm font-semibold">
        Payslip for the Month of {monthName(payslip.periodMonth)}, {payslip.periodYear}
      </p>

      {employee && (
        <div className="grid grid-cols-2 gap-4 rounded-md border p-3 text-xs">
          <div className="space-y-0.5">
            <p>
              <span className="font-medium">Name :</span> {employee.firstName} {employee.lastName}
            </p>
            <p>
              <span className="font-medium">Designation :</span>{" "}
              {employee.designation?.title ?? "—"}
            </p>
            <p>
              <span className="font-medium">Department :</span> {employee.department?.name ?? "—"}
            </p>
            <p>
              <span className="font-medium">Date of Joining :</span>{" "}
              {formatDate(employee.dateOfJoining)}
            </p>
          </div>
          <div className="space-y-0.5">
            <p>
              <span className="font-medium">Employee ID :</span> {employee.employeeCode}
            </p>
            {employee.bankDetail ? (
              <>
                <p>
                  <span className="font-medium">Bank :</span> {employee.bankDetail.bankName}
                </p>
                <p>
                  <span className="font-medium">Account :</span> {employee.bankDetail.accountNumber}
                </p>
                <p>
                  <span className="font-medium">IFSC :</span> {employee.bankDetail.ifscCode}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">No bank details on file</p>
            )}
          </div>
        </div>
      )}

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-muted">
            <th className="border p-1.5 text-left font-medium">Earning</th>
            <th className="border p-1.5 text-right font-medium">Amount</th>
            <th className="border p-1.5 text-left font-medium">Deduction</th>
            <th className="border p-1.5 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: Math.max(earnings.length, deductions.length) }).map((_, i) => {
            const e = earnings[i];
            const d = deductions[i];
            return (
              <tr key={i}>
                <td className="border p-1.5">{e?.label ?? ""}</td>
                <td className="border p-1.5 text-right tabular-nums">
                  {e ? formatINR(e.amount) : ""}
                </td>
                <td className="border p-1.5">{d?.label ?? ""}</td>
                <td className="border p-1.5 text-right tabular-nums">
                  {d ? formatINR(d.amount) : ""}
                </td>
              </tr>
            );
          })}
          <tr className="font-semibold">
            <td className="border p-1.5">Total Earning</td>
            <td className="border p-1.5 text-right tabular-nums">{formatINR(totalEarning)}</td>
            <td className="border p-1.5">Total Deduction</td>
            <td className="border p-1.5 text-right tabular-nums">{formatINR(totalDeduction)}</td>
          </tr>
        </tbody>
      </table>

      <div className="rounded-md border p-3 text-center text-sm font-semibold">
        Net Pay : {formatINR(payslip.netAmount)}
      </div>
    </div>
  );
}

export default function PayslipsPage() {
  const { data, loading, error, refetch } = useAsync(getMyPayslips);
  const [selected, setSelected] = React.useState<Payslip | null>(null);

  function handleDownload(p: Payslip) {
    toast.success(`Downloading ${monthName(p.periodMonth)} ${p.periodYear} payslip`, {
      description: "This is a UI preview - no file is actually generated.",
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Payslips" description="View and download your monthly payslips." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncSection
            loading={loading}
            error={error}
            onRetry={refetch}
            loadingFallback={<TableSkeleton rows={4} columns={4} />}
          >
            {(data ?? []).length === 0 ? (
              <EmptyState icon={Wallet} title="No payslips yet" description="Payslips appear here once generated." />
            ) : (
              <ul className="divide-y">
                {(data ?? []).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setSelected(p)}
                    >
                      <p className="text-sm font-medium hover:underline">
                        {monthName(p.periodMonth)} {p.periodYear}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Net pay {formatINR(p.netAmount)}
                        {p.paidAt ? ` · Paid ${formatDate(p.paidAt)}` : ""}
                      </p>
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={titleCase(p.status)} />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Download payslip"
                        onClick={() => handleDownload(p)}
                      >
                        <Download className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </AsyncSection>
        </CardContent>
      </Card>

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
              <SheetFooter>
                <Button onClick={() => handleDownload(selected)}>
                  <Download />
                  Download PDF
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
