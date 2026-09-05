"use client";

import { useAsync } from "@/lib/use-async";
import { formatINR } from "@/lib/format";
import { getPayrollByDepartment, getPayrollTrend } from "@/lib/mock/mock-api";
import { PageHeader } from "@/components/hrm/page-header";
import { StatCard } from "@/components/hrm/stat-card";
import { ChartCard } from "@/components/hrm/chart-card";
import { AsyncSection } from "@/components/hrm/async-section";
import { CardSkeleton, StatGridSkeleton } from "@/components/hrm/loading-state";
import { BadgeIndianRupee, TrendingUp, Users } from "lucide-react";
import { PayrollByDepartmentChart, PayrollTrendChart } from "./payroll-charts";

export default function PayrollReportsPage() {
  const trend = useAsync(getPayrollTrend);
  const byDept = useAsync(getPayrollByDepartment);

  const latest = trend.data?.at(-1);
  const previous = trend.data?.at(-2);
  const momChange = latest && previous ? ((latest.cost - previous.cost) / previous.cost) * 100 : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Payroll reports" description="Company-wide payroll cost and headcount trends." />

      <AsyncSection
        loading={trend.loading}
        error={trend.error}
        onRetry={trend.refetch}
        loadingFallback={<StatGridSkeleton count={3} />}
      >
        {latest && (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="This month's payroll"
              value={formatINR(latest.cost)}
              icon={BadgeIndianRupee}
              tone="teal"
              trend={
                momChange !== null
                  ? { value: `${momChange >= 0 ? "+" : ""}${momChange.toFixed(1)}% vs last month`, direction: momChange >= 0 ? "up" : "down", positive: false }
                  : undefined
              }
            />
            <StatCard label="Headcount" value={String(latest.headcount)} icon={Users} tone="violet" />
            <StatCard
              label="Avg. cost per employee"
              value={formatINR(Math.round(latest.cost / latest.headcount))}
              icon={TrendingUp}
              tone="orange"
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
          <ChartCard title="Monthly payroll cost" description="Last 6 months.">
            <PayrollTrendChart />
          </ChartCard>
        </AsyncSection>

        <AsyncSection
          loading={byDept.loading}
          error={byDept.error}
          onRetry={byDept.refetch}
          loadingFallback={<CardSkeleton lines={5} />}
        >
          <ChartCard title="Cost by department" description="Current month.">
            <PayrollByDepartmentChart />
          </ChartCard>
        </AsyncSection>
      </div>
    </div>
  );
}
