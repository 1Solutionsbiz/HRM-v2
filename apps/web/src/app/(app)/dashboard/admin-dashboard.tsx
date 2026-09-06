"use client";

import Link from "next/link";
import {
  Award,
  Building2,
  Cake,
  ClipboardList,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { formatDateShort, formatRelativeTime } from "@/lib/format";
import {
  getEmployees,
  getUpcomingBirthdays,
  employeeFullName,
  nextWorkAnniversary,
  titleCase,
} from "@/lib/api/employees";
import {
  getAuditLogs,
  getCompanySettings,
  getEmployeeRoles,
  getCompanyResignations,
  getCompanyLeaveRequests,
  getCompanyExpenseClaims,
  getDepartments,
} from "@/lib/api/admin";
import { StatCard } from "@/components/hrm/stat-card";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { CardSkeleton, StatGridSkeleton } from "@/components/hrm/loading-state";
import { AttendanceBanner } from "@/components/hrm/attendance-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toneClasses } from "@/lib/tone";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, ROLES } from "@/types/role";

const HIGHLIGHT_WINDOW_DAYS = 30;

type Highlight =
  | { kind: "birthday"; id: string; name: string; department: string | null; date: Date; daysUntil: number }
  | {
      kind: "anniversary";
      id: string;
      name: string;
      department: string | null;
      date: Date;
      daysUntil: number;
      years: number;
    };

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

export function AdminDashboard({ firstName }: { firstName: string }) {
  const employees = useAsync(getEmployees);
  const departments = useAsync(getDepartments);
  const logs = useAsync(() => getAuditLogs(4));
  const roles = useAsync(getEmployeeRoles);
  const profile = useAsync(getCompanySettings);
  const resignations = useAsync(getCompanyResignations);
  const leaveRequests = useAsync(getCompanyLeaveRequests);
  const expenseClaims = useAsync(getCompanyExpenseClaims);
  const birthdays = useAsync(getUpcomingBirthdays);

  const activeEmployees = (employees.data ?? []).filter((e) => e.status === "ACTIVE");
  const activeEmployeeIds = new Set(activeEmployees.map((e) => e.id));

  const upcomingAnniversaries = activeEmployees
    .map((e) => {
      const { nextAnniversary, daysUntil, years } = nextWorkAnniversary(e.dateOfJoining);
      return { employee: e, nextAnniversary, daysUntil, years };
    })
    .filter((a) => a.daysUntil <= HIGHLIGHT_WINDOW_DAYS);

  const highlights: Highlight[] = [
    ...(birthdays.data ?? []).map((b) => ({
      kind: "birthday" as const,
      id: b.id,
      name: employeeFullName(b),
      department: b.department?.name ?? null,
      date: new Date(b.nextBirthday),
      daysUntil: b.daysUntil,
    })),
    ...upcomingAnniversaries.map((a) => ({
      kind: "anniversary" as const,
      id: a.employee.id,
      name: employeeFullName(a.employee),
      department: a.employee.department?.name ?? null,
      date: a.nextAnniversary,
      daysUntil: a.daysUntil,
      years: a.years,
    })),
  ].sort((a, b) => a.daysUntil - b.daysUntil);
  const roleCounts = ROLES.map((r) => ({
    role: r,
    count: (roles.data ?? []).filter((row) => row.role === r && activeEmployeeIds.has(row.employeeId)).length,
  }));
  const maxCount = Math.max(1, ...roleCounts.map((r) => r.count));
  const activeRoleCount = roleCounts.filter((r) => r.count > 0).length;
  const pendingResignations = (resignations.data ?? []).filter((r) => r.status === "PENDING");

  const statsLoading = employees.loading || roles.loading || leaveRequests.loading || expenseClaims.loading || resignations.loading || departments.loading;
  const pendingApprovals =
    (leaveRequests.data ?? []).filter((r) => r.status === "PENDING").length +
    (expenseClaims.data ?? []).filter((e) => e.status === "PENDING").length +
    pendingResignations.length;

  return (
    <div className="space-y-6">
      <AttendanceBanner firstName={firstName} description="System Administrator" />

      {statsLoading ? (
        <StatGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total employees" value={String(activeEmployees.length)} icon={Users} tone="teal" />
          <StatCard label="Active roles" value={String(activeRoleCount)} icon={ShieldCheck} tone="violet" />
          <StatCard label="Pending approvals" value={String(pendingApprovals)} icon={ClipboardList} tone="warning" />
          <StatCard label="Departments" value={String((departments.data ?? []).length)} icon={Building2} tone="success" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <WidgetHeader title="System logs" icon={ScrollText} href="/admin/logs" />
          <CardContent>
            <AsyncSection
              loading={logs.loading}
              error={logs.error}
              onRetry={logs.refetch}
              loadingFallback={<CardSkeleton lines={4} />}
            >
              {(logs.data ?? []).length === 0 ? (
                <EmptyState size="sm" icon={ScrollText} title="No recent activity" />
              ) : (
                <ul className="space-y-3">
                  {(logs.data ?? []).map((l) => (
                    <li key={l.id} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{l.actorName}</p>
                        <p className="text-muted-foreground truncate text-[11px]">{l.description}</p>
                      </div>
                      <span className="text-muted-foreground shrink-0 text-[10px]">
                        {formatRelativeTime(l.occurredAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </AsyncSection>
          </CardContent>
        </Card>

        <Card>
          <WidgetHeader title="Roles distribution" icon={ShieldCheck} href="/admin/roles" />
          <CardContent>
            <AsyncSection
              loading={roles.loading}
              error={roles.error}
              onRetry={roles.refetch}
              loadingFallback={<CardSkeleton lines={4} />}
            >
              <div className="space-y-3">
                {roleCounts.map((r) => (
                  <div key={r.role} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{ROLE_LABELS[r.role]}</span>
                      <span className="font-medium tabular-nums">{r.count}</span>
                    </div>
                    <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${(r.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </AsyncSection>
          </CardContent>
        </Card>

        <Card>
          <WidgetHeader title="Company profile" icon={Building2} href="/admin/company" />
          <CardContent>
            <AsyncSection
              loading={profile.loading}
              error={profile.error}
              onRetry={profile.refetch}
              loadingFallback={<CardSkeleton lines={3} />}
            >
              {profile.data && (
                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Legal name</dt>
                    <dd className="truncate font-medium">{profile.data.legalName}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Website</dt>
                    <dd className="truncate font-medium">{profile.data.website ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Support email</dt>
                    <dd className="truncate font-medium">{profile.data.supportEmail}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Timezone</dt>
                    <dd className="truncate font-medium">{profile.data.timezone}</dd>
                  </div>
                </dl>
              )}
            </AsyncSection>
          </CardContent>
        </Card>

        <Card>
          <WidgetHeader title="Highlights" icon={Cake} />
          <CardContent>
            <AsyncSection
              loading={birthdays.loading}
              error={birthdays.error}
              onRetry={birthdays.refetch}
              loadingFallback={<CardSkeleton lines={3} />}
            >
              {highlights.length === 0 ? (
                <EmptyState size="sm" icon={Cake} title="No birthdays or anniversaries in the next 30 days" />
              ) : (
                <ul className="space-y-3">
                  {highlights.map((h) => (
                    <li key={`${h.kind}-${h.id}`} className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full",
                          toneClasses[h.kind === "birthday" ? "orange" : "violet"],
                        )}
                      >
                        {h.kind === "birthday" ? (
                          <Cake className="size-3.5" />
                        ) : (
                          <Award className="size-3.5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{h.name}</p>
                        <p className="text-muted-foreground truncate text-[11px]">
                          {h.department ?? "—"}
                          {h.kind === "anniversary" && ` · ${h.years} yr${h.years > 1 ? "s" : ""}`}
                        </p>
                      </div>
                      <span className="text-muted-foreground shrink-0 text-[11px]">
                        {formatDateShort(h.date)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </AsyncSection>
          </CardContent>
        </Card>

        <Card>
          <WidgetHeader title="Pending resignations" icon={Users} href="/people/resignations" />
          <CardContent>
            <AsyncSection
              loading={resignations.loading}
              error={resignations.error}
              onRetry={resignations.refetch}
              loadingFallback={<CardSkeleton lines={3} />}
            >
              {pendingResignations.length === 0 ? (
                <EmptyState size="sm" icon={Users} title="No pending resignations" />
              ) : (
                <ul className="space-y-3">
                  {pendingResignations.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">
                          {r.employee.firstName} {r.employee.lastName}
                        </p>
                        <p className="text-muted-foreground truncate text-[11px]">
                          {r.employee.designation?.title ?? "No designation"}
                        </p>
                      </div>
                      <StatusBadge status={titleCase(r.status)} className="shrink-0" />
                    </li>
                  ))}
                </ul>
              )}
            </AsyncSection>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
