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
import { ApiError } from "@/lib/api-client";
import { formatDateShort, formatINR, formatRelativeTime } from "@/lib/format";
import { getCompanyAttendance } from "@/lib/api/attendance";
import {
  getCompanyLeaveRequests,
  decideLeaveRequest,
  type CompanyLeaveRequest,
} from "@/lib/api/leave";
import {
  getCompanyExpenseClaims,
  decideExpenseClaim,
  type CompanyExpenseClaim,
} from "@/lib/api/expenses";
import {
  getEmployees,
  getOnboardingSteps,
  getUpcomingBirthdays,
  employeeFullName,
  employeeInitials,
} from "@/lib/api/employees";
import { getAnnouncements, markAnnouncementRead } from "@/lib/api/announcements";
import { StatCard } from "@/components/hrm/stat-card";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { CardSkeleton, StatGridSkeleton } from "@/components/hrm/loading-state";
import { ConfirmDialog } from "@/components/hrm/confirm-dialog";
import { PageHeader } from "@/components/hrm/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const NEW_JOINER_WINDOW_DAYS = 90;

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

async function fetchNewJoinersWithProgress() {
  const employees = await getEmployees();
  const cutoff = Date.now() - NEW_JOINER_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recent = employees
    .filter((e) => e.status === "ACTIVE" && new Date(e.dateOfJoining).getTime() >= cutoff)
    .sort((a, b) => new Date(b.dateOfJoining).getTime() - new Date(a.dateOfJoining).getTime())
    .slice(0, 5);

  return Promise.all(
    recent.map(async (e) => {
      const steps = await getOnboardingSteps(e.id);
      const onboardingProgress = steps.length
        ? Math.round((steps.filter((s) => s.isCompleted).length / steps.length) * 100)
        : 0;
      return { ...e, onboardingProgress };
    }),
  );
}

export function HRDashboard({ firstName }: { firstName: string }) {
  const employees = useAsync(getEmployees);
  const todaysAttendance = useAsync(() => getCompanyAttendance());
  const leaveRequests = useAsync(getCompanyLeaveRequests);
  const expenseClaims = useAsync(getCompanyExpenseClaims);
  const newJoiners = useAsync(fetchNewJoinersWithProgress);
  const birthdays = useAsync(getUpcomingBirthdays);
  const announcements = useAsync(getAnnouncements);

  const [rejectTarget, setRejectTarget] = React.useState<
    { kind: "leave" | "expense"; id: string; label: string } | null
  >(null);

  async function handleApproveLeave(r: CompanyLeaveRequest) {
    try {
      await decideLeaveRequest(r.id, "APPROVED");
      toast.success(`${employeeFullName(r.employee)}'s leave request approved`);
      leaveRequests.refetch();
      todaysAttendance.refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't approve this request.");
    }
  }

  async function handleApproveExpense(e: CompanyExpenseClaim) {
    try {
      await decideExpenseClaim(e.id, "APPROVED");
      toast.success(`${employeeFullName(e.employee)}'s expense claim approved`);
      expenseClaims.refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't approve this claim.");
    }
  }

  async function handleReject() {
    if (!rejectTarget) return;
    try {
      if (rejectTarget.kind === "leave") {
        await decideLeaveRequest(rejectTarget.id, "REJECTED");
        leaveRequests.refetch();
      } else {
        await decideExpenseClaim(rejectTarget.id, "REJECTED");
        expenseClaims.refetch();
      }
      toast.success(`${rejectTarget.label} rejected`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't reject this.");
    } finally {
      setRejectTarget(null);
    }
  }

  async function handleOpenAnnouncement(id: string, read: boolean) {
    if (!read) {
      await markAnnouncementRead(id);
      announcements.refetch();
    }
  }

  const activeEmployees = (employees.data ?? []).filter((e) => e.status === "ACTIVE");
  const attendanceRows = todaysAttendance.data ?? [];
  const presentToday = attendanceRows.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
  const onLeaveToday = attendanceRows.filter((r) => r.status === "ON_LEAVE").length;
  const lateToday = attendanceRows.filter((r) => r.status === "LATE").length;
  const pendingLeave = (leaveRequests.data ?? []).filter((r) => r.status === "PENDING");
  const pendingExpense = (expenseClaims.data ?? []).filter((e) => e.status === "PENDING");
  const unreadAnnouncements = (announcements.data ?? []).filter((a) => !a.read);

  const headcountLoading =
    employees.loading || todaysAttendance.loading || leaveRequests.loading || expenseClaims.loading;
  const headcountError = employees.error || todaysAttendance.error || leaveRequests.error || expenseClaims.error;

  return (
    <div className="space-y-6">
      <PageHeader title={`Good to see you, ${firstName}`} description="HR Business Partner" />

      <AsyncSection
        loading={headcountLoading}
        error={headcountError}
        onRetry={() => {
          employees.refetch();
          todaysAttendance.refetch();
          leaveRequests.refetch();
          expenseClaims.refetch();
        }}
        loadingFallback={<StatGridSkeleton count={5} />}
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Employees" value={String(activeEmployees.length)} icon={Users} tone="teal" />
          <StatCard label="Present" value={String(presentToday)} icon={UserCheck} tone="success" />
          <StatCard label="On leave" value={String(onLeaveToday)} icon={Clock} tone="violet" />
          <StatCard label="Late" value={String(lateToday)} icon={Clock} tone="warning" />
          <StatCard
            label="Pending requests"
            value={String(pendingLeave.length + pendingExpense.length)}
            icon={Receipt}
            tone="orange"
          />
        </div>
      </AsyncSection>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {/* Attendance */}
        <Card>
          <WidgetHeader title="Attendance" icon={UserCheck} href="/team/attendance" />
          <CardContent>
            <AsyncSection
              loading={todaysAttendance.loading}
              error={todaysAttendance.error}
              onRetry={todaysAttendance.refetch}
              loadingFallback={<CardSkeleton lines={3} />}
            >
              {activeEmployees.length > 0 && (
                <div className="space-y-3">
                  {[
                    { label: "Present", value: presentToday, tone: "bg-success" },
                    { label: "On leave", value: onLeaveToday, tone: "bg-(--chart-5)" },
                    { label: "Late", value: lateToday, tone: "bg-warning" },
                  ].map((row) => (
                    <div key={row.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="font-medium tabular-nums">
                          {row.value} / {activeEmployees.length}
                        </span>
                      </div>
                      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                        <div
                          className={`h-full rounded-full ${row.tone}`}
                          style={{ width: `${(row.value / activeEmployees.length) * 100}%` }}
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
          <WidgetHeader title="Leave requests" icon={Clock} href="/team/leave-approvals" />
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
                        <AvatarFallback className="text-[10px]">{employeeInitials(r.employee)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{employeeFullName(r.employee)}</p>
                        <p className="text-muted-foreground truncate text-[11px]">
                          {r.leaveType.name} · {formatDateShort(r.startDate)}
                          {r.startDate !== r.endDate ? `–${formatDateShort(r.endDate)}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-success hover:text-success"
                          aria-label="Approve"
                          onClick={() => handleApproveLeave(r)}
                        >
                          <Check className="size-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          aria-label="Reject"
                          onClick={() =>
                            setRejectTarget({
                              kind: "leave",
                              id: r.id,
                              label: `${employeeFullName(r.employee)}'s leave request`,
                            })
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
          <WidgetHeader title="Expense claims" icon={Receipt} href="/team/expense-approvals" />
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
                        <AvatarFallback className="text-[10px]">{employeeInitials(e.employee)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{employeeFullName(e.employee)}</p>
                        <p className="text-muted-foreground truncate text-[11px]">
                          {e.category.name} · {formatINR(e.amount)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-success hover:text-success"
                          aria-label="Approve"
                          onClick={() => handleApproveExpense(e)}
                        >
                          <Check className="size-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          aria-label="Reject"
                          onClick={() =>
                            setRejectTarget({
                              kind: "expense",
                              id: e.id,
                              label: `${employeeFullName(e.employee)}'s expense claim`,
                            })
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
                        {j.avatarUrl && <AvatarImage src={j.avatarUrl} alt="" />}
                        <AvatarFallback className="text-[10px]">{employeeInitials(j)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{employeeFullName(j)}</p>
                        <p className="text-muted-foreground truncate text-[11px]">
                          {j.designation?.title ?? "—"}
                        </p>
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
                <EmptyState size="sm" icon={Cake} title="No birthdays in the next 30 days" />
              ) : (
                <ul className="space-y-3">
                  {(birthdays.data ?? []).map((b) => (
                    <li key={b.id} className="flex items-center gap-2.5">
                      <Avatar className="size-7 shrink-0">
                        <AvatarFallback className="text-[10px]">{employeeInitials(b)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{employeeFullName(b)}</p>
                        <p className="text-muted-foreground truncate text-[11px]">{b.department?.name ?? "—"}</p>
                      </div>
                      <span className="text-muted-foreground shrink-0 text-[11px]">
                        {formatDateShort(b.nextBirthday)}
                      </span>
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
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => handleOpenAnnouncement(a.id, a.read)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-medium">{a.title}</p>
                          <span className="text-muted-foreground shrink-0 text-[10px]">
                            {formatRelativeTime(a.publishedAt)}
                          </span>
                        </div>
                        <p className="text-muted-foreground truncate text-[11px]">{a.body}</p>
                      </button>
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
