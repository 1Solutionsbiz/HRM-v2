"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { payrollByDepartment, payrollMonthlyTrend } from "@/lib/mock/hr-fixtures";

const trendConfig = {
  cost: { label: "Payroll cost", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function PayrollTrendChart() {
  return (
    <ChartContainer config={trendConfig} className="aspect-auto h-64 w-full">
      <BarChart data={payrollMonthlyTrend} barCategoryGap={24}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => `₹${(Number(value) / 100000).toFixed(1)}L`}
            />
          }
        />
        <Bar dataKey="cost" fill="var(--color-cost)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

const deptConfig = {
  cost: { label: "Cost", color: "var(--chart-3)" },
} satisfies ChartConfig;

export function PayrollByDepartmentChart() {
  return (
    <ChartContainer config={deptConfig} className="aspect-auto h-72 w-full">
      <BarChart data={payrollByDepartment} layout="vertical" margin={{ left: 16 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" tickLine={false} axisLine={false} hide />
        <YAxis
          dataKey="department"
          type="category"
          tickLine={false}
          axisLine={false}
          width={110}
          tick={{ fontSize: 12 }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => `₹${(Number(value) / 100000).toFixed(1)}L`}
            />
          }
        />
        <Bar dataKey="cost" fill="var(--color-cost)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
