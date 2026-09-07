import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { toneClasses, type Tone } from "@/lib/tone";
import { cn } from "@/lib/utils";

interface QuickActionProps {
  href: string;
  icon: LucideIcon;
  label: string;
  tone?: Tone;
  /** Overrides `tone` with an exact brand color when a design-system tone doesn't match (e.g. a client-specified hex). */
  iconClassName?: string;
}

export function QuickAction({ href, icon: Icon, label, tone = "primary", iconClassName }: QuickActionProps) {
  return (
    <Link
      href={href}
      className="hover:bg-accent hover:border-accent-foreground/10 flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors"
    >
      <div className={cn("flex size-9 items-center justify-center rounded-full", iconClassName ?? toneClasses[tone])}>
        <Icon className="size-4.5" />
      </div>
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}
