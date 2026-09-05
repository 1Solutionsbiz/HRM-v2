import type { LucideIcon } from "lucide-react";
import type { Role } from "./role";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Roles that can see this item. Omit to show to every role. */
  roles?: Role[];
  badge?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}
