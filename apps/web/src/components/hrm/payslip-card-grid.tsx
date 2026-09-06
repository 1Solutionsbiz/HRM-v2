"use client";

import * as React from "react";
import { Download, Search, Wallet } from "lucide-react";
import { monthName, type Payslip } from "@/lib/api/payroll";
import { EmptyState } from "@/components/hrm/empty-state";
import { Input } from "@/components/ui/input";

interface PayslipCardGridProps {
  payslips: Payslip[];
  onOpen: (payslip: Payslip) => void;
  onDownload: (payslip: Payslip) => void;
}

// A grid of one card per payslip (icon, "Salary", month/year, download) -
// the legacy hrmpulse.com layout also showed a "Tax" card per month, but V2
// has no separate tax-document type or generation logic, so this only
// covers the one real document type that exists today.
export function PayslipCardGrid({ payslips, onOpen, onDownload }: PayslipCardGridProps) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return payslips;
    return payslips.filter((p) => `${monthName(p.periodMonth)} ${p.periodYear}`.toLowerCase().includes(q));
  }, [payslips, query]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          placeholder="Search…"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={payslips.length === 0 ? "No payslips yet" : "No payslips match your search"}
          description={payslips.length === 0 ? "Payslips appear here once generated." : undefined}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="hover:bg-accent hover:border-accent-foreground/10 flex items-center gap-3 rounded-lg border p-3 transition-colors"
            >
              <button
                type="button"
                onClick={() => onOpen(p)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <div className="bg-(--chart-3)/10 text-(--chart-3) flex size-9 shrink-0 items-center justify-center rounded-full">
                  <Wallet className="size-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold hover:underline">Salary</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {monthName(p.periodMonth)}, {p.periodYear}
                  </p>
                </div>
              </button>
              <button
                type="button"
                aria-label="Download payslip"
                onClick={() => onDownload(p)}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <Download className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
