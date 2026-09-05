import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface QuickActionProps {
  href: string;
  icon: LucideIcon;
  label: string;
}

export function QuickAction({ href, icon: Icon, label }: QuickActionProps) {
  return (
    <Link
      href={href}
      className="hover:bg-accent hover:border-accent-foreground/10 flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors"
    >
      <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-full">
        <Icon className="size-4.5" />
      </div>
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}
