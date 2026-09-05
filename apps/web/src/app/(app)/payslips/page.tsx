"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, Wallet } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { getMyPayslips, monthName, type Payslip } from "@/lib/api/payroll";
import { titleCase } from "@/lib/api/employees";
import { formatDate, formatINR } from "@/lib/format";
import { downloadPayslipPdf } from "@/lib/payslip-pdf";
import { PageHeader } from "@/components/hrm/page-header";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { TableSkeleton } from "@/components/hrm/loading-state";
import { PayslipDocument } from "@/components/hrm/payslip-document";
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

export default function PayslipsPage() {
  const { data, loading, error, refetch } = useAsync(getMyPayslips);
  const [selected, setSelected] = React.useState<Payslip | null>(null);

  function handleDownload(p: Payslip) {
    downloadPayslipPdf(p);
    toast.success(`Downloaded ${monthName(p.periodMonth)} ${p.periodYear} payslip`);
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
