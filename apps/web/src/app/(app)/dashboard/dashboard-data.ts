import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BadgeIndianRupee,
  CalendarDays,
  ClipboardList,
  Megaphone,
  ShieldCheck,
  TrendingDown,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import type { Role } from "@/types/role";
import type { Tone as StatTone } from "@/lib/tone";

export interface DashboardStat {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: StatTone;
  trend?: { value: string; direction: "up" | "down"; positive?: boolean };
  description?: string;
}

/**
 * Sample/illustrative numbers only - there is no backend yet. This exists to
 * prove out the dashboard layout and components across all four roles, not
 * to model real attendance/payroll/approval logic. Icons/tones are assigned
 * per metric (not just cycled) so the ones needing attention read distinctly
 * from routine counts.
 */
export function getDashboardStats(role: Role): DashboardStat[] {
  switch (role) {
    case "manager":
      return [
        { label: "Team present today", value: "9 / 11", icon: UserCheck, tone: "success", description: "2 on approved leave" },
        { label: "Pending approvals", value: "3", icon: ClipboardList, tone: "warning", trend: { value: "2 new today", direction: "up", positive: false } },
        { label: "Team size", value: "11", icon: Users, tone: "teal" },
        { label: "Open tickets", value: "2", icon: AlertTriangle, tone: "orange" },
      ];
    case "hr":
      return [
        { label: "Total employees", value: "142", icon: Users, tone: "teal", trend: { value: "+4 this month", direction: "up" } },
        { label: "Pending approvals", value: "12", icon: ClipboardList, tone: "warning" },
        { label: "Open onboarding", value: "3", icon: UserCheck, tone: "violet" },
        { label: "Attrition (30d)", value: "1.4%", icon: TrendingDown, tone: "success", trend: { value: "-0.3%", direction: "down", positive: true } },
      ];
    case "admin":
      return [
        { label: "Total employees", value: "142", icon: Users, tone: "teal" },
        { label: "Active roles", value: "4", icon: ShieldCheck, tone: "violet" },
        { label: "Pending approvals", value: "12", icon: ClipboardList, tone: "warning" },
        { label: "System alerts", value: "0", icon: UserX, tone: "success", description: "All systems normal" },
      ];
    case "employee":
    default:
      return [
        { label: "Attendance this month", value: "96%", icon: UserCheck, tone: "success", trend: { value: "+2% vs last month", direction: "up" } },
        { label: "Leave balance", value: "8 days", icon: CalendarDays, tone: "teal" },
        { label: "Pending expenses", value: "₹2,400", icon: BadgeIndianRupee, tone: "warning", description: "1 awaiting approval" },
        { label: "Unread announcements", value: "2", icon: Megaphone, tone: "orange" },
      ];
  }
}

export const sampleAttendanceTrend = [
  { day: "Mon", present: 128, onLeave: 8 },
  { day: "Tue", present: 132, onLeave: 6 },
  { day: "Wed", present: 121, onLeave: 12 },
  { day: "Thu", present: 134, onLeave: 5 },
  { day: "Fri", present: 118, onLeave: 15 },
];

export const sampleAnnouncements = [
  {
    title: "Diwali holiday schedule",
    body: "Office closed Nov 12–13. Full calendar in Announcements.",
    time: "2h ago",
  },
  {
    title: "New expense policy",
    body: "Reimbursement cap for travel updated to ₹5,000/month.",
    time: "1d ago",
  },
];

export interface SampleRequest {
  id: string;
  employee: string;
  type: string;
  date: string;
  status: "Pending" | "Approved" | "Rejected";
}

export const sampleTeamRequests: SampleRequest[] = [
  { id: "1", employee: "Neha Kapoor", type: "Leave", date: "12 Nov", status: "Pending" },
  { id: "2", employee: "Aditi Sharma", type: "Expense", date: "10 Nov", status: "Pending" },
  { id: "3", employee: "Vikram Rao", type: "Leave", date: "09 Nov", status: "Approved" },
  { id: "4", employee: "Sana Iqbal", type: "Asset request", date: "08 Nov", status: "Rejected" },
];

export interface SamplePayslip {
  id: string;
  month: string;
  net: string;
  status: "Paid" | "Pending";
}

export const samplePayslips: SamplePayslip[] = [
  { id: "1", month: "October 2026", net: "₹68,400", status: "Paid" },
  { id: "2", month: "September 2026", net: "₹68,400", status: "Paid" },
  { id: "3", month: "August 2026", net: "₹66,900", status: "Paid" },
];
