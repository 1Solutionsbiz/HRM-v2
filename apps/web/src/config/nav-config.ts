import {
  LayoutDashboard,
  Clock,
  CalendarDays,
  Wallet,
  FolderOpen,
  Megaphone,
  Vote,
  Trophy,
  LifeBuoy,
  Ticket,
  Users,
  UserPlus,
  UserMinus,
  ClipboardList,
  NotebookPen,
  FolderKanban,
  BadgeIndianRupee,
  BarChart3,
  Building2,
  ShieldCheck,
  ScrollText,
  Palette,
  PartyPopper,
  BookOpen,
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
      {
        title: "My Day",
        url: "/my-day",
        icon: LayoutDashboard,
        color: "text-sky-500",
        roles: ["employee"],
      },
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: LayoutDashboard,
        color: "text-blue-500",
        roles: ["manager", "hr", "admin"],
      },
    ],
  },
  {
    label: "My work",
    items: [
      { title: "Attendance", url: "/attendance", icon: Clock, color: "text-amber-500" },
      { title: "Daily Report", url: "/daily-report", icon: NotebookPen, color: "text-sky-600" },
      { title: "Leave", url: "/leave", icon: CalendarDays, color: "text-emerald-500" },
      { title: "Holidays", url: "/holidays", icon: PartyPopper, color: "text-rose-500" },
      { title: "Requests", url: "/requests", icon: ClipboardList, color: "text-violet-500" },
      { title: "Expenses", url: "/expenses", icon: BadgeIndianRupee, color: "text-orange-500" },
      { title: "Payslips", url: "/payslips", icon: Wallet, color: "text-teal-500" },
      { title: "Documents", url: "/documents", icon: FolderOpen, color: "text-indigo-500" },
    ],
  },
  {
    label: "Team",
    items: [
      {
        title: "Team attendance",
        url: "/team/attendance",
        icon: Clock,
        color: "text-cyan-500",
        // Not "manager" - attendance:manage (this page's permission) is
        // only granted to hr/admin in seed.ts's ROLE_PERMISSIONS, unlike
        // leave:approve/expense:approve just below, which manager does
        // hold. Showing this to a manager would 403 on load.
        roles: ["hr", "admin"],
      },
      {
        title: "Daily Reports",
        url: "/team/daily-reports",
        icon: NotebookPen,
        color: "text-sky-500",
        // performance:manage (this page's permission) is granted to
        // manager/hr/admin in seed.ts, same as Leave approvals below.
        roles: ["manager", "hr", "admin"],
      },
      {
        title: "Leave approvals",
        url: "/team/leave-approvals",
        icon: ClipboardList,
        color: "text-lime-500",
        roles: ["manager", "hr", "admin"],
      },
      {
        title: "Leave balances",
        url: "/team/leave-balances",
        icon: CalendarDays,
        color: "text-fuchsia-500",
        roles: ["manager", "hr", "admin"],
      },
      {
        title: "Expense approvals",
        url: "/team/expense-approvals",
        icon: BadgeIndianRupee,
        color: "text-red-500",
        roles: ["manager", "hr", "admin"],
      },
      {
        title: "Ticket management",
        url: "/team/tickets",
        icon: Ticket,
        color: "text-purple-500",
        // ticket:manage is only granted to hr/admin in seed.ts, same
        // reasoning as "Team attendance" above.
        roles: ["hr", "admin"],
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
        color: "text-pink-500",
        roles: ["hr", "admin"],
      },
      {
        title: "Onboarding",
        url: "/people/onboarding",
        icon: UserPlus,
        color: "text-green-500",
        roles: ["hr", "admin"],
      },
      {
        title: "Resignations",
        url: "/people/resignations",
        icon: UserMinus,
        color: "text-stone-500",
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
        color: "text-yellow-500",
        roles: ["hr", "admin"],
      },
      {
        title: "Payslips",
        url: "/payroll/payslips",
        icon: Wallet,
        color: "text-blue-600",
        roles: ["hr", "admin"],
      },
      {
        title: "Payroll reports",
        url: "/payroll/reports",
        icon: BarChart3,
        color: "text-orange-600",
        roles: ["hr", "admin"],
      },
    ],
  },
  {
    label: "Engagement",
    items: [
      { title: "Announcements", url: "/announcements", icon: Megaphone, color: "text-red-600" },
      { title: "Polls", url: "/polls", icon: Vote, color: "text-violet-600" },
      {
        title: "Employee of the month",
        url: "/recognition",
        icon: Trophy,
        color: "text-yellow-600",
      },
      { title: "HR Handbook", url: "/handbook", icon: BookOpen, color: "text-teal-600" },
      { title: "Help & support", url: "/support", icon: LifeBuoy, color: "text-lime-600" },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        title: "Company settings",
        url: "/admin/company",
        icon: Building2,
        color: "text-cyan-600",
        roles: ["admin"],
      },
      {
        title: "Projects",
        url: "/admin/projects",
        icon: FolderKanban,
        color: "text-emerald-600",
        roles: ["admin"],
      },
      {
        title: "Roles & permissions",
        url: "/admin/roles",
        icon: ShieldCheck,
        color: "text-fuchsia-600",
        roles: ["admin"],
      },
      {
        title: "System logs",
        url: "/admin/logs",
        icon: ScrollText,
        color: "text-purple-600",
        roles: ["admin"],
      },
      {
        title: "Design system",
        url: "/style-guide",
        icon: Palette,
        color: "text-pink-600",
        roles: ["admin"],
      },
    ],
  },
];

/**
 * The subset of nav items surfaced as bottom-tab shortcuts on mobile.
 * Kept short and employee-first per the mobile design priority - the
 * remaining items (including Daily Report) are one tap away in the "More"
 * sheet. Employees get the four things they touch most often day-to-day
 * (attendance and leave beat payslips, which is a once-a-month check tucked
 * into "More" instead; tickets beat the more general leave/expense
 * "Requests" list, per user feedback that raising a ticket is the more
 * common action here).
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
    { title: "Tickets", url: "/support", icon: Ticket },
  ];
}
