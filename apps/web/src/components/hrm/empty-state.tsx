import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  size?: "sm" | "default";
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = "default",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed text-center",
        size === "default" ? "gap-3 px-6 py-12" : "gap-2 px-4 py-6",
        className,
      )}
    >
      {Icon && (
        <div
          className={cn(
            "bg-muted text-muted-foreground flex items-center justify-center rounded-full",
            size === "default" ? "size-12" : "size-9",
          )}
        >
          <Icon className={size === "default" ? "size-6" : "size-4.5"} />
        </div>
      )}
      <div className="space-y-1">
        <p
          className={cn(
            "text-foreground font-medium",
            size === "default" ? "text-sm" : "text-xs",
          )}
        >
          {title}
        </p>
        {description && (
          <p className="text-muted-foreground max-w-sm text-xs text-balance">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
