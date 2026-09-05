import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ClipboardList,
  ShieldCheck,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
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
 * Sample/illustrative numbers only - there is no backend yet. Only
 * "manager" and "admin" are handled here: HR's dashboard is fully data-
 * driven (see hr-dashboard.tsx) and employees never reach /dashboard at all
 * (they land on /my-day), so there's no case for either.
 */
export function getDashboardStats(role: "manager" | "admin"): DashboardStat[] {
  if (role === "manager") {
    return [
      { label: "Team present today", value: "9 / 11", icon: UserCheck, tone: "success", description: "2 on approved leave" },
      { label: "Pending approvals", value: "3", icon: ClipboardList, tone: "warning", trend: { value: "2 new today", direction: "up", positive: false } },
      { label: "Team size", value: "11", icon: Users, tone: "teal" },
      { label: "Open tickets", value: "2", icon: AlertTriangle, tone: "orange" },
    ];
  }
  return [
    { label: "Total employees", value: "142", icon: Users, tone: "teal" },
    { label: "Active roles", value: "4", icon: ShieldCheck, tone: "violet" },
    { label: "Pending approvals", value: "12", icon: ClipboardList, tone: "warning" },
    { label: "System alerts", value: "0", icon: UserX, tone: "success", description: "All systems normal" },
  ];
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
