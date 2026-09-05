"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Cake,
  Check,
  Clock,
  Megaphone,
  Receipt,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { formatDateShort, formatINR, formatRelativeTime } from "@/lib/format";
import {
  decideCompanyExpenseClaim,
  decideCompanyLeaveRequest,
  getAnnouncements,
  getCompanyExpenseClaims,
  getCompanyHeadcountSummary,
  getCompanyLeaveRequests,
  getNewJoiners,
  getUpcomingBirthdays,
} from "@/lib/mock/mock-api";
import { StatCard } from "@/components/hrm/stat-card";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { CardSkeleton, StatGridSkeleton } from "@/components/hrm/loading-state";
import { ConfirmDialog } from "@/components/hrm/confirm-dialog";
import { PageHeader } from "@/components/hrm/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

function WidgetHeader({
  title,
  icon: Icon,
  href,
}: {
  title: string;
  icon: React.ElementType;
  href?: string;
}) {
  return (
    <CardHeader className="flex flex-row items-center justify-between">
      <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      <div className="flex items-center gap-2">
        {href && (
          <Link href={href} className="text-primary text-xs font-medium hover:underline">
            View all
          </Link>
        )}
        <Icon className="text-muted-foreground size-4" />
      </div>
    </CardHeader>
  );
}

export function HRDashboard({ firstName }: { firstName: string }) {
  const headcount = useAsync(getCompanyHeadcountSummary);
  const leaveRequests = useAsync(getCompanyLeaveRequests);
  const expenseClaims = useAsync(getCompanyExpenseClaims);
  const newJoiners = useAsync(getNewJoiners);
  const birthdays = useAsync(getUpcomingBirthdays);
  const announcements = useAsync(getAnnouncements);

  const [rejectTarget, setRejectTarget] = React.useState<{ kind: "leave" | "expense"; id: string; label: string } | null>(null);

  async function handleApproveLeave(id: string, name: string) {
    await decideCompanyLeaveRequest(id, "Approved");
    toast.success(`${name}'s leave request approved`);
    leaveRequests.refetch();
    headcount.refetch();
  }

  async function handleApproveExpense(id: string, name: string) {
    await decideCompanyExpenseClaim(id, "Approved");
    toast.success(`${name}'s expense claim approved`);
    expenseClaims.refetch();
    headcount.refetch();
  }

  async function handleReject() {
    if (!rejectTarget) return;
    if (rejectTarget.kind === "leave") {
      await decideCompanyLeaveRequest(rejectTarget.id, "Rejected");
    } else {
      await decideCompanyExpenseClaim(rejectTarget.id, "Rejected");
    }
    toast.success(`${rejectTarget.label} rejected`);
    leaveRequests.refetch();
    expenseClaims.refetch();
    headcount.refetch();
  }

  const pendingLeave = (leaveRequests.data ?? []).filter((r) => r.status === "Pending");
  const pendingExpense = (expenseClaims.data ?? []).filter((e) => e.status === "Pending");
  const unreadAnnouncements = (announcements.data ?? []).filter((a) => !a.read);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good to see you, ${firstName}`}
        description="HR Business Partner · Viewing as HR (preview)"
      />

      <AsyncSection
        loading={headcount.loading}
        error={headcount.error}
        onRetry={headcount.refetch}
        loadingFallback={<StatGridSkeleton count={5} />}
      >
        {headcount.data && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Employees" value={String(headcount.data.totalEmployees)} icon={Users} tone="teal" />
            <StatCard label="Present" value={String(headcount.data.presentToday)} icon={UserCheck} tone="success" />
            <StatCard label="On leave" value={String(headcount.data.onLeaveToday)} icon={Clock} tone="violet" />
            <StatCard label="Late" value={String(headcount.data.lateToday)} icon={Clock} tone="warning" />
            <StatCard label="Pending requests" value={String(headcount.data.pendingRequests)} icon={Receipt} tone="orange" />
          </div>
        )}
      </AsyncSection>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {/* Attendance */}
        <Card>
          <WidgetHeader title="Attendance" icon={UserCheck} href="/team/attendance" />
          <CardContent>
            <AsyncSection
              loading={headcount.loading}
              error={headcount.error}
              onRetry={headcount.refetch}
              loadingFallback={<CardSkeleton lines={3} />}
            >
              {headcount.data && (
                <div className="space-y-3">
                  {[
                    { label: "Present", value: headcount.data.presentToday, tone: "bg-success" },
                    { label: "On leave", value: headcount.data.onLeaveToday, tone: "bg-(--chart-5)" },
                    { label: "Late", value: headcount.data.lateToday, tone: "bg-warning" },
                  ].map((row) => (
                    <div key={row.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="font-medium tabular-nums">
                          {row.value} / {headcount.data!.totalEmployees}
                        </span>
                      </div>
                      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                        <div
                          className={`h-full rounded-full ${row.tone}`}
                          style={{ width: `${(row.value / headcount.data!.totalEmployees) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AsyncSection>
          </CardContent>
        </Card>

        {/* Leave requests */}
        <Card>
          <WidgetHeader title="Leave requests" icon={Clock} />
          <CardContent>
            <AsyncSection
              loading={leaveRequests.loading}
              error={leaveRequests.error}
              onRetry={leaveRequests.refetch}
              loadingFallback={<CardSkeleton lines={3} />}
            >
              {pendingLeave.length === 0 ? (
                <EmptyState size="sm" icon={Clock} title="No pending leave requests" />
              ) : (
                <ul className="space-y-3">
                  {pendingLeave.slice(0, 4).map((r) => (
                    <li key={r.id} className="flex items-center gap-2.5">
                      <Avatar className="size-7 shrink-0">
                        <AvatarFallback className="text-[10px]">{r.avatarInitials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{r.employeeName}</p>
                        <p className="text-muted-foreground truncate text-[11px]">
                          {r.type} · {formatDateShort(r.startDate)}
                          {r.startDate !== r.endDate ? `–${formatDateShort(r.endDate)}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-success hover:text-success"
                          aria-label="Approve"
                          onClick={() => handleApproveLeave(r.id, r.employeeName)}
                        >
                          <Check className="size-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          aria-label="Reject"
                          onClick={() =>
                            setRejectTarget({ kind: "leave", id: r.id, label: `${r.employeeName}'s leave request` })
                          }
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </AsyncSection>
          </CardContent>
        </Card>

        {/* Expense claims */}
        <Card>
          <WidgetHeader title="Expense claims" icon={Receipt} />
          <CardContent>
            <AsyncSection
              loading={expenseClaims.loading}
              error={expenseClaims.error}
              onRetry={expenseClaims.refetch}
              loadingFallback={<CardSkeleton lines={3} />}
            >
              {pendingExpense.length === 0 ? (
                <EmptyState size="sm" icon={Receipt} title="No pending expense claims" />
              ) : (
                <ul className="space-y-3">
                  {pendingExpense.slice(0, 4).map((e) => (
                    <li key={e.id} className="flex items-center gap-2.5">
                      <Avatar className="size-7 shrink-0">
                        <AvatarFallback className="text-[10px]">{e.avatarInitials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{e.employeeName}</p>
                        <p className="text-muted-foreground truncate text-[11px]">
                          {e.category} · {formatINR(e.amount)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-success hover:text-success"
                          aria-label="Approve"
                          onClick={() => handleApproveExpense(e.id, e.employeeName)}
                        >
                          <Check className="size-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          aria-label="Reject"
                          onClick={() =>
                            setRejectTarget({ kind: "expense", id: e.id, label: `${e.employeeName}'s expense claim` })
                          }
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </AsyncSection>
          </CardContent>
        </Card>

        {/* New employees */}
        <Card>
          <WidgetHeader title="New employees" icon={UserPlus} href="/people/onboarding" />
          <CardContent>
            <AsyncSection
              loading={newJoiners.loading}
              error={newJoiners.error}
              onRetry={newJoiners.refetch}
              loadingFallback={<CardSkeleton lines={3} />}
            >
              {(newJoiners.data ?? []).length === 0 ? (
                <EmptyState size="sm" icon={UserPlus} title="No recent joiners" />
              ) : (
                <ul className="space-y-3">
                  {(newJoiners.data ?? []).map((j) => (
                    <li key={j.id} className="flex items-center gap-2.5">
                      <Avatar className="size-7 shrink-0">
                        <AvatarFallback className="text-[10px]">{j.avatarInitials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{j.name}</p>
                        <p className="text-muted-foreground truncate text-[11px]">{j.designation}</p>
                      </div>
                      <div className="w-16 shrink-0">
                        <Progress value={j.onboardingProgress} className="h-1.5" />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </AsyncSection>
          </CardContent>
        </Card>

        {/* Upcoming birthdays */}
        <Card>
          <WidgetHeader title="Upcoming birthdays" icon={Cake} />
          <CardContent>
            <AsyncSection
              loading={birthdays.loading}
              error={birthdays.error}
              onRetry={birthdays.refetch}
              loadingFallback={<CardSkeleton lines={3} />}
            >
              {(birthdays.data ?? []).length === 0 ? (
                <EmptyState size="sm" icon={Cake} title="No birthdays this week" />
              ) : (
                <ul className="space-y-3">
                  {(birthdays.data ?? []).map((b) => (
                    <li key={b.id} className="flex items-center gap-2.5">
                      <Avatar className="size-7 shrink-0">
                        <AvatarFallback className="text-[10px]">{b.avatarInitials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{b.name}</p>
                        <p className="text-muted-foreground truncate text-[11px]">{b.department}</p>
                      </div>
                      <span className="text-muted-foreground shrink-0 text-[11px]">{formatDateShort(b.date)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </AsyncSection>
          </CardContent>
        </Card>

        {/* Announcements */}
        <Card>
          <WidgetHeader title="Announcements" icon={Megaphone} href="/announcements" />
          <CardContent>
            <AsyncSection
              loading={announcements.loading}
              error={announcements.error}
              onRetry={announcements.refetch}
              loadingFallback={<CardSkeleton lines={3} />}
            >
              {unreadAnnouncements.length === 0 ? (
                <EmptyState size="sm" icon={Megaphone} title="You're all caught up" />
              ) : (
                <ul className="space-y-3">
                  {unreadAnnouncements.slice(0, 3).map((a) => (
                    <li key={a.id}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-medium">{a.title}</p>
                        <span className="text-muted-foreground shrink-0 text-[10px]">
                          {formatRelativeTime(a.publishedAt)}
                        </span>
                      </div>
                      <p className="text-muted-foreground truncate text-[11px]">{a.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </AsyncSection>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={!!rejectTarget}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        title="Reject this request?"
        description={rejectTarget ? `${rejectTarget.label} will be marked as rejected. This can't be undone.` : ""}
        confirmLabel="Reject"
        variant="destructive"
        onConfirm={handleReject}
      />
    </div>
  );
}

