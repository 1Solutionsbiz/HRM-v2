"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ChartTooltip, ChartLegend } from "@/components/ui/chart";
import { sampleAttendanceTrend } from "./dashboard-data";

const chartConfig = {
  present: { label: "Present", color: "var(--chart-1)" },
  onLeave: { label: "On leave", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function AttendanceTrendChart() {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <BarChart data={sampleAttendanceTrend} barCategoryGap={24}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="present"
          fill="var(--color-present)"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="onLeave"
          fill="var(--color-onLeave)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}
