export type Tone = "primary" | "success" | "warning" | "destructive" | "violet" | "orange" | "teal";

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
  destructive: "bg-destructive/10 text-destructive",
  violet: "bg-(--chart-5)/10 text-(--chart-5)",
  orange: "bg-(--chart-2)/10 text-(--chart-2)",
  teal: "bg-(--chart-3)/10 text-(--chart-3)",
};

/**
 * Same tone tokens as toneClasses, applied as a full card background
 * instead of just an icon tint - light enough at 10% opacity to keep text
 * readable, and (unlike a literal Tailwind palette color such as
 * bg-violet-50) built on the app's own light/dark-aware CSS variables, so
 * it doesn't go washed-out or wrong in dark mode.
 */
export const cardToneClasses: Record<Tone, string> = {
  primary: "bg-primary/10",
  success: "bg-success/10",
  warning: "bg-warning/15",
  destructive: "bg-destructive/10",
  violet: "bg-(--chart-5)/10",
  orange: "bg-(--chart-2)/10",
  teal: "bg-(--chart-3)/10",
};
