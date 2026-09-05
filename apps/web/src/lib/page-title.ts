import { navGroups } from "@/config/nav-config";

const TITLE_OVERRIDES: Record<string, string> = {
  "/settings/profile": "Profile & settings",
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
