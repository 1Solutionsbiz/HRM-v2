"use client";

import * as React from "react";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Circle,
  FolderOpen,
  Megaphone,
  Receipt,
  TrendingUp,
  Users,
  Video,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useAuthenticatedUser } from "@/lib/auth-context";
import { useAsync } from "@/lib/use-async";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { getMyDaySummary, getAnnouncements } from "@/lib/mock/mock-api";
import { getLeaveBalances } from "@/lib/api/leave";
import { PageHeader } from "@/components/hrm/page-header";
import { StatCard } from "@/components/hrm/stat-card";
import { AttendanceCard } from "@/components/hrm/attendance-card";
import { AttendanceCalendarCard } from "@/components/hrm/attendance-calendar-card";
import { QuickAction } from "@/components/hrm/quick-action";
import { AsyncSection } from "@/components/hrm/async-section";
import { StatGridSkeleton, CardSkeleton } from "@/components/hrm/loading-state";
import { EmptyState } from "@/components/hrm/empty-state";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function MyDayPage() {
  const user = useAuthenticatedUser();
  const { data, loading, error, refetch } = useAsync(getMyDaySummary);
  const announcementsQuery = useAsync(getAnnouncements);
  const leaveBalances = useAsync(getLeaveBalances);
  const [taskDone, setTaskDone] = React.useState<Record<string, boolean>>({});

  const today = formatDate(new Date().toISOString(), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const unreadAnnouncements = (announcementsQuery.data ?? []).filter((a) => !a.read).slice(0, 2);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${getGreeting()}, ${user.name.split(" ")[0]}`}
        description={user.designation ? `${today} · ${user.designation}` : today}
      />

      <AttendanceCard variant="compact" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickAction href="/leave/apply" icon={CalendarDays} label="Apply leave" tone="teal" />
        <QuickAction href="/expenses/add" icon={Receipt} label="Add expense" tone="warning" />
        <QuickAction href="/payslips" icon={Wallet} label="View payslip" tone="success" />
        <QuickAction href="/documents" icon={FolderOpen} label="Documents" tone="violet" />
      </div>

      <AsyncSection
        loading={loading || leaveBalances.loading}
        error={error || leaveBalances.error}
        onRetry={() => {
          refetch();
          leaveBalances.refetch();
        }}
        loadingFallback={<StatGridSkeleton count={4} />}
        errorTitle="Couldn't load your overview"
      >
        {data && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/leave">
              <StatCard
                label="Leave balance"
                value={`${(leaveBalances.data ?? []).reduce((sum, b) => sum + b.remainingDays, 0)} days`}
                icon={CalendarDays}
                tone="teal"
                description="Across all leave types"
              />
            </Link>
            <Link href="/requests">
              <StatCard
                label="Pending requests"
                value={String(data.pendingRequestsCount)}
                icon={Circle}
                tone="warning"
                description={data.pendingRequestsCount > 0 ? "Awaiting approval" : "All clear"}
              />
            </Link>
            <Link href="/notifications">
              <StatCard
                label="Notifications"
                value={String(data.unreadNotificationsCount)}
                icon={Bell}
                tone="violet"
                description="Unread"
              />
            </Link>
            <Link href="/announcements">
              <StatCard
                label="Announcements"
                value={String(data.unreadAnnouncementsCount)}
                icon={Megaphone}
                tone="orange"
                description="New for you"
              />
            </Link>
          </div>
        )}
      </AsyncSection>

      <AttendanceCalendarCard />

      <div className="grid gap-4 lg:grid-cols-2">
        <AsyncSection
          loading={loading}
          error={error}
          onRetry={refetch}
          loadingFallback={<CardSkeleton lines={3} />}
        >
          {data && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Today&apos;s tasks</CardTitle>
                <span className="text-muted-foreground text-xs">
                  {data.tasks.filter((t) => !(taskDone[t.id] ?? t.done)).length} open
                </span>
              </CardHeader>
              <CardContent>
                {data.tasks.length === 0 ? (
                  <EmptyState size="sm" icon={CheckCircle2} title="Nothing on your list today" />
                ) : (
                  <ul className="space-y-3">
                    {data.tasks.map((task) => {
                      const done = taskDone[task.id] ?? task.done;
                      return (
                        <li key={task.id} className="flex items-start gap-2.5">
                          <button
                            type="button"
                            aria-label={done ? "Mark as not done" : "Mark as done"}
                            onClick={() =>
                              setTaskDone((prev) => ({ ...prev, [task.id]: !done }))
                            }
                            className="mt-0.5 shrink-0"
                          >
                            {done ? (
                              <CheckCircle2 className="text-success size-4" />
                            ) : (
                              <Circle className="text-muted-foreground size-4" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <p className={done ? "text-muted-foreground text-sm line-through" : "text-sm"}>
                              {task.title}
                            </p>
                            <p className="text-muted-foreground text-xs">{task.dueLabel}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </AsyncSection>

        <AsyncSection
          loading={loading}
          error={error}
          onRetry={refetch}
          loadingFallback={<CardSkeleton lines={3} />}
        >
          {data && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Upcoming meetings</CardTitle>
                <Video className="text-(--chart-3) size-4" />
              </CardHeader>
              <CardContent>
                {data.meetings.length === 0 ? (
                  <EmptyState size="sm" icon={Video} title="No meetings scheduled today" />
                ) : (
                  <ul className="space-y-3">
                    {data.meetings.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-2 border-b pb-3 last:border-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{m.title}</p>
                          <p className="text-muted-foreground flex items-center gap-1 text-xs">
                            <Users className="size-3" /> {m.withWhom}
                          </p>
                        </div>
                        <Badge variant="secondary" className="shrink-0">{m.time}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </AsyncSection>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Announcements</CardTitle>
            <Link href="/announcements" className="text-primary text-xs font-medium hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <AsyncSection
              loading={announcementsQuery.loading}
              error={announcementsQuery.error}
              onRetry={announcementsQuery.refetch}
              loadingFallback={<CardSkeleton lines={2} />}
            >
              {unreadAnnouncements.length === 0 ? (
                <EmptyState size="sm" icon={Megaphone} title="You're all caught up" />
              ) : (
                <ul className="space-y-3">
                  {unreadAnnouncements.map((a) => (
                    <li key={a.id} className="border-b pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{a.title}</p>
                        <span className="text-muted-foreground shrink-0 text-[10px]">
                          {formatRelativeTime(a.publishedAt)}
                        </span>
                      </div>
                      <p className="text-muted-foreground line-clamp-1 text-xs">{a.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </AsyncSection>
          </CardContent>
        </Card>

        <AsyncSection
          loading={loading}
          error={error}
          onRetry={refetch}
          loadingFallback={<CardSkeleton lines={2} />}
        >
          {data && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Performance snapshot</CardTitle>
                <Link href="/performance" className="text-primary text-xs font-medium hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.performance.goals.slice(0, 2).map((g) => (
                  <div key={g.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{g.title}</span>
                      <span className="text-muted-foreground">{g.progress}%</span>
                    </div>
                    <Progress value={g.progress} />
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <TrendingUp className="text-(--chart-5) size-3.5" />
                  <p className="text-muted-foreground text-xs">
                    Last review: {data.performance.lastReview.rating}/{data.performance.lastReview.outOf} ({data.performance.lastReview.cycle})
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </AsyncSection>
      </div>
    </div>
  );
}
