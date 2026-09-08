"use client";

import { CalendarDays, FolderOpen, LifeBuoy, Receipt, Wallet } from "lucide-react";
import { useAuthenticatedUser } from "@/lib/auth-context";
import { formatDate } from "@/lib/format";
import { AttendanceCard } from "@/components/hrm/attendance-card";
import { AttendanceCalendarCard } from "@/components/hrm/attendance-calendar-card";
import { HighlightsCard } from "@/components/hrm/highlights-card";
import { AnnouncementsFeedCard } from "@/components/hrm/announcements-feed-card";
import { LeaveBalanceCard } from "@/components/hrm/leave-balance-card";
import { YesterdayAttendanceCard } from "@/components/hrm/yesterday-attendance-card";
import { TicketsSummaryCard } from "@/components/hrm/tickets-summary-card";
import { MoodHistoryCard } from "@/components/hrm/mood-history-card";
import { QuickAction } from "@/components/hrm/quick-action";
import { PageHeader } from "@/components/hrm/page-header";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function MyDayPage() {
  const user = useAuthenticatedUser();

  const today = formatDate(new Date().toISOString(), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${getGreeting()}, ${user.name.split(" ")[0]}`}
        description={user.designation ? `${today} · ${user.designation}` : today}
      />

      <AttendanceCard variant="compact" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <QuickAction href="/leave/apply" icon={CalendarDays} label="Apply leave" tone="teal" />
        <QuickAction href="/expenses/add" icon={Receipt} label="Add expense" tone="warning" />
        <QuickAction href="/payslips" icon={Wallet} label="View payslip" tone="success" />
        <QuickAction href="/documents" icon={FolderOpen} label="Documents" tone="violet" />
        <QuickAction
          href="/support"
          icon={LifeBuoy}
          label="Raise a ticket"
          iconClassName="bg-[#44973d]/10 text-[#44973d]"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <HighlightsCard />
          <AttendanceCalendarCard linkHref="/attendance" />
        </div>

        <AnnouncementsFeedCard />

        <div className="space-y-4">
          <LeaveBalanceCard />
          <YesterdayAttendanceCard />
          <TicketsSummaryCard />
          <MoodHistoryCard />
        </div>
      </div>
    </div>
  );
}
