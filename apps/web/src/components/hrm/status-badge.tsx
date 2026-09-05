import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusTone =
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "neutral";

const toneClasses: Record<StatusTone, string> = {
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/15 text-warning-foreground border-warning/30 dark:text-warning",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
  info: "bg-info/10 text-info border-info/20",
  neutral: "bg-muted text-muted-foreground border-transparent",
};

/**
 * Maps the status strings used across HRM modules (leave, expenses, tickets,
 * resignations, assets...) to one consistent tone, so every page renders the
 * same status the same way rather than re-deciding a color per feature.
 */
const STATUS_TONE_MAP: Record<string, StatusTone> = {
  approved: "success",
  active: "success",
  present: "success",
  resolved: "success",
  completed: "success",
  paid: "success",
  verified: "success",
  pending: "warning",
  "in progress": "warning",
  "on leave": "warning",
  "half day": "warning",
  reopened: "warning",
  processing: "warning",
  "pending review": "warning",
  late: "warning",
  rejected: "destructive",
  declined: "destructive",
  cancelled: "destructive",
  absent: "destructive",
  inactive: "destructive",
  overdue: "destructive",
  missing: "destructive",
  open: "info",
  closed: "neutral",
  draft: "neutral",
  archived: "neutral",
  weekend: "neutral",
  holiday: "neutral",
};

function toneForLabel(label: string): StatusTone {
  return STATUS_TONE_MAP[label.trim().toLowerCase()] ?? "neutral";
}

interface StatusBadgeProps extends React.ComponentProps<"span"> {
  status: string;
  /** Override the automatic status -> tone mapping. */
  tone?: StatusTone;
}

export function StatusBadge({
  status,
  tone,
  className,
  ...props
}: StatusBadgeProps) {
  const resolvedTone = tone ?? toneForLabel(status);
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClasses[resolvedTone],
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          resolvedTone === "success" && "bg-success",
          resolvedTone === "warning" && "bg-warning",
          resolvedTone === "destructive" && "bg-destructive",
          resolvedTone === "info" && "bg-info",
          resolvedTone === "neutral" && "bg-muted-foreground",
        )}
      />
      {status}
    </span>
  );
}
