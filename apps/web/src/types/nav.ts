import type { LucideIcon } from "lucide-react";
import type { Role } from "./role";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Tailwind text-color class applied to the icon (e.g. "text-amber-500"). */
  color?: string;
  /** Roles that can see this item. Omit to show to every role. */
  roles?: Role[];
  badge?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}
