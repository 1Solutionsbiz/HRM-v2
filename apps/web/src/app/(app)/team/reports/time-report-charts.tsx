"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatDateShort, formatMinutes } from "@/lib/format";
import type { TimeReportBucket } from "@/lib/api/daily-reports";

/** The design system's 5 categorical chart tokens, cycled by index so each project/person gets a distinct color. */
const ENTITY_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function buildBreakdownConfig(data: TimeReportBucket[]): ChartConfig {
  const config: ChartConfig = {};
  data.forEach((b, i) => {
    config[b.key] = { label: b.label, color: ENTITY_COLORS[i % ENTITY_COLORS.length] };
  });
  return config;
}

/** Horizontal bar, one row per project (by-employee mode) or per person (by-project mode) - each bar its own color from the design system's chart palette. */
export function TimeBreakdownChart({ data }: { data: TimeReportBucket[] }) {
  const chartData = data.map((b, i) => ({
    key: b.key,
    label: b.label,
    minutes: b.minutes,
    fill: ENTITY_COLORS[i % ENTITY_COLORS.length],
  }));
  const height = Math.max(160, chartData.length * 36 + 40);

  return (
    <ChartContainer config={buildBreakdownConfig(data)} className="aspect-auto w-full" style={{ height }}>
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
        <Bar dataKey="minutes" radius={[0, 4, 4, 0]}>
          {chartData.map((d) => (
            <Cell key={d.key} fill={d.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** Same data as TimeBreakdownChart, as a pie instead - same per-entity colors, with a legend since color now carries identity. */
export function TimeBreakdownPieChart({ data }: { data: TimeReportBucket[] }) {
  const chartData = data.map((b, i) => ({
    key: b.key,
    label: b.label,
    minutes: b.minutes,
    fill: ENTITY_COLORS[i % ENTITY_COLORS.length],
  }));

  return (
    <ChartContainer config={buildBreakdownConfig(data)} className="aspect-auto h-72 w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatMinutes(Number(value))} />} />
        <Pie data={chartData} dataKey="minutes" nameKey="label" innerRadius={50} outerRadius={90}>
          {chartData.map((d) => (
            <Cell key={d.key} fill={d.fill} />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="label" />} />
      </PieChart>
    </ChartContainer>
  );
}

const trendConfig = {
  minutes: { label: "Reported time", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** Vertical bar, one column per day in range - single series (a day isn't a project/person), same shape as PayrollTrendChart. */
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
