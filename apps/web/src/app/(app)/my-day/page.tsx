"use client";

import { CalendarDays, FolderOpen, LifeBuoy, Receipt, Wallet } from "lucide-react";
import { useAuthenticatedUser } from "@/lib/auth-context";
import { useAsync } from "@/lib/use-async";
import { getMyProfile, computeProfileCompleteness } from "@/lib/api/employees";
import { AttendanceBanner } from "@/components/hrm/attendance-banner";
import { AttendanceCalendarCard } from "@/components/hrm/attendance-calendar-card";
import { HighlightsCard } from "@/components/hrm/highlights-card";
import { AnnouncementsFeedCard } from "@/components/hrm/announcements-feed-card";
import { LeaveBalanceCard } from "@/components/hrm/leave-balance-card";
import { YesterdayAttendanceCard } from "@/components/hrm/yesterday-attendance-card";
import { TicketsSummaryCard } from "@/components/hrm/tickets-summary-card";
import { MoodHistoryCard } from "@/components/hrm/mood-history-card";
import { PollsDashboardWidget } from "@/components/hrm/polls-dashboard-widget";
import { ThoughtOfTheDayCard } from "@/components/hrm/thought-of-the-day-card";
import { QuickAction } from "@/components/hrm/quick-action";
import { cardToneClasses } from "@/lib/tone";

export default function MyDayPage() {
  const user = useAuthenticatedUser();
  const profile = useAsync(getMyProfile);

  return (
    <div className="space-y-6">
      <AttendanceBanner
        firstName={user.name.split(" ")[0]!}
        description="Hope you are having a great day"
        profileCompletionPercent={profile.data ? computeProfileCompleteness(profile.data) : undefined}
        showSettingsLink
      />

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
          <HighlightsCard className={cardToneClasses.orange} />
          <PollsDashboardWidget className={cardToneClasses.violet} />
          <AttendanceCalendarCard linkHref="/attendance" className={cardToneClasses.teal} />
        </div>

        <AnnouncementsFeedCard className={cardToneClasses.warning} />

        <div className="space-y-4">
          <ThoughtOfTheDayCard className={cardToneClasses.teal} />
          <LeaveBalanceCard className={cardToneClasses.success} />
          <YesterdayAttendanceCard className={cardToneClasses.primary} />
          <TicketsSummaryCard className={cardToneClasses.destructive} />
          <MoodHistoryCard className={cardToneClasses.violet} />
        </div>
      </div>
    </div>
  );
}
