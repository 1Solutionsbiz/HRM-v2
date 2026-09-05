"use client";

import Link from "next/link";
import {
  Building2,
  ScrollText,
  ShieldCheck,
  UserMinus,
} from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { formatRelativeTime } from "@/lib/format";
import {
  getAuditLogs,
  getCompanyProfile,
  getEmployeeRoles,
  getResignationRequests,
} from "@/lib/mock/mock-api";
import { getDashboardStats } from "./dashboard-data";
import { StatCard } from "@/components/hrm/stat-card";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { PageHeader } from "@/components/hrm/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE_LABELS, ROLES } from "@/types/role";

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
  const stats = getDashboardStats("admin");
  const logs = useAsync(getAuditLogs);
  const roles = useAsync(getEmployeeRoles);
  const profile = useAsync(getCompanyProfile);
  const resignations = useAsync(getResignationRequests);

  const roleCounts = ROLES.map((r) => ({
    role: r,
    count: (roles.data ?? []).filter((row) => row.role === r).length,
  }));
  const maxCount = Math.max(1, ...roleCounts.map((r) => r.count));
  const pendingResignations = (resignations.data ?? []).filter((r) => r.status === "Pending");

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good to see you, ${firstName}`}
        description="System Administrator · Viewing as Admin (preview)"
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} tone={s.tone} description={s.description} trend={s.trend} />
        ))}
      </div>

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
                  {(logs.data ?? []).slice(0, 4).map((l) => (
                    <li key={l.id} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">
                          {l.actor} · {l.action}
                        </p>
                        <p className="text-muted-foreground truncate text-[11px]">{l.target}</p>
                      </div>
                      <span className="text-muted-foreground shrink-0 text-[10px]">
                        {formatRelativeTime(l.timestamp)}
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
                    <dd className="truncate font-medium">{profile.data.name}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Website</dt>
                    <dd className="truncate font-medium">{profile.data.website}</dd>
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
          <WidgetHeader title="Pending resignations" icon={UserMinus} href="/people/resignations" />
          <CardContent>
            <AsyncSection
              loading={resignations.loading}
              error={resignations.error}
              onRetry={resignations.refetch}
              loadingFallback={<CardSkeleton lines={3} />}
            >
              {pendingResignations.length === 0 ? (
                <EmptyState size="sm" icon={UserMinus} title="No pending resignations" />
              ) : (
                <ul className="space-y-3">
                  {pendingResignations.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{r.employeeName}</p>
                        <p className="text-muted-foreground truncate text-[11px]">{r.designation}</p>
                      </div>
                      <StatusBadge status={r.status} className="shrink-0" />
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
