"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { getMyPayslips, monthName, type Payslip } from "@/lib/api/payroll";
import { formatDate } from "@/lib/format";
import { downloadPayslipPdf } from "@/lib/payslip-pdf";
import { PageHeader } from "@/components/hrm/page-header";
import { AsyncSection } from "@/components/hrm/async-section";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { PayslipDocument } from "@/components/hrm/payslip-document";
import { PayslipCardGrid } from "@/components/hrm/payslip-card-grid";
import { Button } from "@/components/ui/button";
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

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={refetch}
        loadingFallback={<CardSkeleton lines={4} />}
      >
        <PayslipCardGrid payslips={data ?? []} onOpen={setSelected} onDownload={handleDownload} />
      </AsyncSection>

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
