"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatDateShort, formatMinutes } from "@/lib/format";
import type { TimeReportBucket } from "@/lib/api/daily-reports";

const breakdownConfig = {
  minutes: { label: "Reported time", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** Horizontal bar, one row per project (by-employee mode) or per person (by-project mode) - single series, same shape as PayrollByDepartmentChart. */
export function TimeBreakdownChart({ data }: { data: TimeReportBucket[] }) {
  const chartData = data.map((b) => ({ label: b.label, minutes: b.minutes }));
  const height = Math.max(160, chartData.length * 36 + 40);

  return (
    <ChartContainer config={breakdownConfig} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 16 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" tickLine={false} axisLine={false} hide />
        <YAxis
          dataKey="label"
          type="category"
          tickLine={false}
          axisLine={false}
          width={130}
          tick={{ fontSize: 12 }}
        />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatMinutes(Number(value))} />} />
        <Bar dataKey="minutes" fill="var(--color-minutes)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

const trendConfig = {
  minutes: { label: "Reported time", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** Vertical bar, one column per day in range - single series, same shape as PayrollTrendChart. */
export function TimeTrendChart({ data }: { data: { date: string; minutes: number }[] }) {
  const chartData = data.map((d) => ({ date: formatDateShort(d.date), minutes: d.minutes }));

  return (
    <ChartContainer config={trendConfig} className="aspect-auto h-64 w-full">
      <BarChart data={chartData} barCategoryGap={chartData.length > 20 ? 2 : 16}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={chartData.length > 14 ? Math.ceil(chartData.length / 14) - 1 : 0}
        />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatMinutes(Number(value))} />} />
        <Bar dataKey="minutes" fill="var(--color-minutes)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
