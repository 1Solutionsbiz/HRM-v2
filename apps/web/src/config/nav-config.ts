import {
  LayoutDashboard,
  Clock,
  CalendarDays,
  Wallet,
  FolderOpen,
  Laptop,
  Megaphone,
  Trophy,
  LifeBuoy,
  Users,
  UserPlus,
  UserMinus,
  ClipboardList,
  BadgeIndianRupee,
  BarChart3,
  Building2,
  ShieldCheck,
  ScrollText,
  Palette,
  TrendingUp,
} from "lucide-react";
import type { NavGroup } from "@/types/nav";
import type { Role } from "@/types/role";

/**
 * HRM V2 navigation, grouped by purpose rather than by role.
 * Every item declares which roles can see it; the sidebar filters at render
 * time based on the current role. Items with no `roles` are visible to
 * everyone (an admin and an HR lead are still employees with their own
 * attendance/leave/payslips).
 */
export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "My Day", url: "/my-day", icon: LayoutDashboard, roles: ["employee"] },
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: LayoutDashboard,
        roles: ["manager", "hr", "admin"],
      },
    ],
  },
  {
    label: "My work",
    items: [
      { title: "Attendance", url: "/attendance", icon: Clock },
      { title: "Leave", url: "/leave", icon: CalendarDays },
      { title: "Requests", url: "/requests", icon: ClipboardList },
      { title: "Expenses", url: "/expenses", icon: BadgeIndianRupee },
      { title: "Payslips", url: "/payslips", icon: Wallet },
      { title: "Documents", url: "/documents", icon: FolderOpen },
      { title: "Performance", url: "/performance", icon: TrendingUp },
      { title: "My assets", url: "/assets", icon: Laptop },
    ],
  },
  {
    label: "Team",
    items: [
      {
        title: "Team attendance",
        url: "/team/attendance",
        icon: Clock,
        roles: ["manager", "hr", "admin"],
      },
      {
        title: "Leave approvals",
        url: "/team/leave-approvals",
        icon: ClipboardList,
        roles: ["manager", "hr", "admin"],
      },
      {
        title: "Team directory",
        url: "/team/directory",
        icon: Users,
        roles: ["manager", "hr", "admin"],
      },
    ],
  },
  {
    label: "People",
    items: [
      {
        title: "Employees",
        url: "/people/employees",
        icon: Users,
        roles: ["hr", "admin"],
      },
      {
        title: "Onboarding",
        url: "/people/onboarding",
        icon: UserPlus,
        roles: ["hr", "admin"],
      },
      {
        title: "Resignations",
        url: "/people/resignations",
        icon: UserMinus,
        roles: ["hr", "admin"],
      },
    ],
  },
  {
    label: "Payroll",
    items: [
      {
        title: "Salary management",
        url: "/payroll/salary",
        icon: BadgeIndianRupee,
        roles: ["hr", "admin"],
      },
      {
        title: "Payroll reports",
        url: "/payroll/reports",
        icon: BarChart3,
        roles: ["hr", "admin"],
      },
    ],
  },
  {
    label: "Engagement",
    items: [
      { title: "Announcements", url: "/announcements", icon: Megaphone },
      { title: "Employee of the month", url: "/recognition", icon: Trophy },
      { title: "Help & support", url: "/support", icon: LifeBuoy },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        title: "Company settings",
        url: "/admin/company",
        icon: Building2,
        roles: ["admin"],
      },
      {
        title: "Roles & permissions",
        url: "/admin/roles",
        icon: ShieldCheck,
        roles: ["admin"],
      },
      {
        title: "System logs",
        url: "/admin/logs",
        icon: ScrollText,
        roles: ["admin"],
      },
      {
        title: "Design system",
        url: "/style-guide",
        icon: Palette,
        roles: ["admin"],
      },
    ],
  },
];

/**
 * The subset of nav items surfaced as bottom-tab shortcuts on mobile.
 * Kept short and employee-first per the mobile design priority - the
 * remaining items are one tap away in the "More" sheet. Employees get the
 * four things they touch most often day-to-day (attendance and leave beat
 * payslips, which is a once-a-month check tucked into "More" instead).
 */
export function getMobilePrimaryNav(role: Role) {
  const home =
    role === "employee"
      ? { title: "My Day", url: "/my-day", icon: LayoutDashboard }
      : { title: "Home", url: "/dashboard", icon: LayoutDashboard };
  return [
    home,
    { title: "Attendance", url: "/attendance", icon: Clock },
    { title: "Leave", url: "/leave", icon: CalendarDays },
    { title: "Requests", url: "/requests", icon: ClipboardList },
  ];
}
