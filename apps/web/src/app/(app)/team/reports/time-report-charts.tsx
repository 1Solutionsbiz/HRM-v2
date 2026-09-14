"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
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

function withColorAndPercent(data: TimeReportBucket[]) {
  const total = data.reduce((sum, b) => sum + b.minutes, 0);
  return data.map((b, i) => ({
    key: b.key,
    label: b.label,
    minutes: b.minutes,
    percent: total > 0 ? Math.round((b.minutes / total) * 100) : 0,
    fill: ENTITY_COLORS[i % ENTITY_COLORS.length],
  }));
}

function buildBreakdownConfig(data: ReturnType<typeof withColorAndPercent>): ChartConfig {
  const config: ChartConfig = {};
  data.forEach((d) => {
    config[d.key] = { label: d.label, color: d.fill };
  });
  return config;
}

/** Horizontal bar, one row per project (by-employee mode) or per person (by-project mode) - each bar its own color, with a "name · X%" label at the end. */
export function TimeBreakdownChart({ data }: { data: TimeReportBucket[] }) {
  const chartData = withColorAndPercent(data);
  const height = Math.max(160, chartData.length * 36 + 40);

  return (
    <ChartContainer config={buildBreakdownConfig(chartData)} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 16, right: 44 }}>
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
          <LabelList
            dataKey="percent"
            position="right"
            className="fill-foreground text-xs"
            formatter={(value: unknown) => (value == null ? "" : `${String(value)}%`)}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** Same data as TimeBreakdownChart, as a pie instead - same per-entity colors, with a "name · X%" legend below (built manually rather than recharts' auto legend, which can't be keyed by this shape). */
export function TimeBreakdownPieChart({ data }: { data: TimeReportBucket[] }) {
  const chartData = withColorAndPercent(data);

  return (
    <div className="space-y-3">
      <ChartContainer config={buildBreakdownConfig(chartData)} className="aspect-auto h-64 w-full">
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, _name, item) => `${formatMinutes(Number(value))} (${item.payload.percent}%)`}
              />
            }
          />
          <Pie data={chartData} dataKey="minutes" nameKey="label" innerRadius={50} outerRadius={90}>
            {chartData.map((d) => (
              <Cell key={d.key} fill={d.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {chartData.map((d) => (
          <li key={d.key} className="flex items-center gap-1.5 text-xs">
            <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: d.fill }} />
            <span className="font-medium">{d.label}</span>
            <span className="text-muted-foreground">{d.percent}%</span>
          </li>
        ))}
      </ul>
    </div>
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
