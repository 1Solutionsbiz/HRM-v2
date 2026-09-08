"use client";

import { useAsync } from "@/lib/use-async";
import { formatINR } from "@/lib/format";
import { getCommittedPayroll, getPayrollByDepartment, getPayrollTrend } from "@/lib/api/payroll";
import { getOperatingExpenses } from "@/lib/api/operating-expenses";
import { PageHeader } from "@/components/hrm/page-header";
import { StatCard } from "@/components/hrm/stat-card";
import { ChartCard } from "@/components/hrm/chart-card";
import { AsyncSection } from "@/components/hrm/async-section";
import { CardSkeleton, StatGridSkeleton } from "@/components/hrm/loading-state";
import { BadgeIndianRupee, Landmark, TrendingUp, Users } from "lucide-react";
import { PayrollByDepartmentChart, PayrollTrendChart } from "./payroll-charts";
import { OperatingExpensesCard } from "./operating-expenses-card";

export default function PayrollReportsPage() {
  const committed = useAsync(() => getCommittedPayroll());
  const opex = useAsync(() => getOperatingExpenses());
  const trend = useAsync(() => getPayrollTrend());
  const byDept = useAsync(() => getPayrollByDepartment());

  const totalCompanyCost =
    committed.data && opex.data ? committed.data.cost + opex.data.total : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll reports"
        description="Committed payroll and operating costs, live from the active roster — not from however many payslips happen to exist yet."
      />

      <AsyncSection
        loading={committed.loading || opex.loading}
        error={committed.error ?? opex.error}
        onRetry={() => {
          committed.refetch();
          opex.refetch();
        }}
        loadingFallback={<StatGridSkeleton count={4} />}
      >
        {committed.data && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Committed monthly payroll"
              value={formatINR(committed.data.cost)}
              icon={BadgeIndianRupee}
              tone="teal"
            />
            <StatCard label="Active headcount" value={String(committed.data.headcount)} icon={Users} tone="violet" />
            <StatCard
              label="Avg. cost per employee"
              value={formatINR(
                committed.data.headcount > 0 ? Math.round(committed.data.cost / committed.data.headcount) : 0,
              )}
              icon={TrendingUp}
              tone="orange"
            />
            <StatCard
              label="Total company cost"
              value={totalCompanyCost !== null ? formatINR(totalCompanyCost) : "—"}
              icon={Landmark}
              tone="primary"
            />
          </div>
        )}
      </AsyncSection>

      <div className="grid gap-4 lg:grid-cols-2">
        <AsyncSection
          loading={trend.loading}
          error={trend.error}
          onRetry={trend.refetch}
          loadingFallback={<CardSkeleton lines={5} />}
        >
          <ChartCard title="Processed payroll" description="Gross amount across generated payslips, last 6 months.">
            <PayrollTrendChart data={trend.data ?? []} />
          </ChartCard>
        </AsyncSection>

        <AsyncSection
          loading={byDept.loading}
          error={byDept.error}
          onRetry={byDept.refetch}
          loadingFallback={<CardSkeleton lines={5} />}
        >
          <ChartCard title="Cost by department" description="From the latest processed payslips.">
            <PayrollByDepartmentChart data={byDept.data ?? []} />
          </ChartCard>
        </AsyncSection>
      </div>

      <OperatingExpensesCard />
    </div>
  );
}
