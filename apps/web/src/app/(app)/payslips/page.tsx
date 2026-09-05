"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, Wallet } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { getPayslips } from "@/lib/mock/mock-api";
import { formatDate, formatINR } from "@/lib/format";
import type { Payslip } from "@/lib/mock/fixtures";
import { PageHeader } from "@/components/hrm/page-header";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { TableSkeleton } from "@/components/hrm/loading-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";

export default function PayslipsPage() {
  const { data, loading, error, refetch } = useAsync(getPayslips);
  const [selected, setSelected] = React.useState<Payslip | null>(null);

  function handleDownload(p: Payslip) {
    toast.success(`Downloading ${p.month} ${p.year} payslip`, {
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
                        {p.month} {p.year}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Net pay {formatINR(p.netPay)}
                        {p.paidOn ? ` · Paid ${formatDate(p.paidOn)}` : ""}
                      </p>
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={p.status} />
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
        <SheetContent>
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {selected.month} {selected.year}
                </SheetTitle>
                <SheetDescription>
                  {selected.paidOn ? `Paid on ${formatDate(selected.paidOn)}` : "Processing"}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4">
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                    Earnings
                  </p>
                  <div className="space-y-1.5">
                    {selected.earnings.map((e) => (
                      <div key={e.label} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{e.label}</span>
                        <span className="tabular-nums">{formatINR(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                    Deductions
                  </p>
                  <div className="space-y-1.5">
                    {selected.deductions.map((d) => (
                      <div key={d.label} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{d.label}</span>
                        <span className="tabular-nums">- {formatINR(d.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between text-sm font-semibold">
                  <span>Net pay</span>
                  <span className="tabular-nums">{formatINR(selected.netPay)}</span>
                </div>
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
