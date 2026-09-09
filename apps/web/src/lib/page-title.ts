import { navGroups } from "@/config/nav-config";

const TITLE_OVERRIDES: Record<string, string> = {
  "/attendance/history": "Attendance history",
  "/leave/apply": "Apply leave",
  "/expenses/add": "Add expense",
};

/** Looks up the sidebar title for a route, falling back to a humanized segment. */
export function getPageTitle(pathname: string): string {
  if (TITLE_OVERRIDES[pathname]) return TITLE_OVERRIDES[pathname];

  for (const group of navGroups) {
    for (const item of group.items) {
      if (pathname === item.url || pathname.startsWith(`${item.url}/`)) {
        return item.title;
      }
    }
  }

  const last = pathname.split("/").filter(Boolean).pop() ?? "Dashboard";
  return last
    .split("-")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

export interface BreadcrumbItem {
  label: string;
  url?: string;
}

/** Group label + page title (and, for a subpage, its parent nav item) for the topbar's breadcrumb. */
export function getBreadcrumb(pathname: string): BreadcrumbItem[] {
  for (const group of navGroups) {
    for (const item of group.items) {
      if (pathname === item.url) {
        return [{ label: group.label }, { label: item.title }];
      }
      if (pathname.startsWith(`${item.url}/`)) {
        return [
          { label: group.label },
          { label: item.title, url: item.url },
          { label: getPageTitle(pathname) },
        ];
      }
    }
  }
  return [{ label: getPageTitle(pathname) }];
}
