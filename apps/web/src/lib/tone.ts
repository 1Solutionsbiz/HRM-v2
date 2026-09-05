export type Tone = "primary" | "success" | "warning" | "violet" | "orange" | "teal";

/**
 * Icon/accent tones, drawn from the same validated palette the charts use
 * (chart-2/3/5) plus the status colors - shared by StatCard and QuickAction
 * so a metric or action reads as visually distinct rather than every one
 * getting the same blue-tinted icon.
 */
export const toneClasses: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning-foreground dark:text-warning",
  violet: "bg-(--chart-5)/10 text-(--chart-5)",
  orange: "bg-(--chart-2)/10 text-(--chart-2)",
  teal: "bg-(--chart-3)/10 text-(--chart-3)",
};
