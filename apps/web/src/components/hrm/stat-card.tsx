import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toneClasses, type Tone as StatTone } from "@/lib/tone";

export type { StatTone };

interface StatCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  tone?: StatTone;
  trend?: {
    value: string;
    direction: "up" | "down";
    /** Whether an "up" trend is good news for this metric (default true). */
    positive?: boolean;
  };
  description?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  trend,
  description,
  className,
}: StatCardProps) {
  const trendIsGood = trend
    ? trend.direction === "up"
      ? (trend.positive ?? true)
      : !(trend.positive ?? true)
    : null;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {label}
        </CardTitle>
        {Icon && (
          <div
            className={cn(
              "flex size-8 items-center justify-center rounded-md",
              toneClasses[tone],
            )}
          >
            <Icon className="size-4" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {trend && (
          <p
            className={cn(
              "mt-1 flex items-center gap-1 text-xs font-medium",
              trendIsGood ? "text-success" : "text-destructive",
            )}
          >
            {trend.direction === "up" ? (
              <ArrowUp className="size-3.5" />
            ) : (
              <ArrowDown className="size-3.5" />
            )}
            {trend.value}
          </p>
        )}
        {description && (
          <p className="text-muted-foreground mt-1 text-xs">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
