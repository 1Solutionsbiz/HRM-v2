"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarPlus, Ban } from "lucide-react";
import { toast } from "sonner";
import { useAsync } from "@/lib/use-async";
import { getLeaveBalances, getMyLeaveRequests, cancelLeaveRequest } from "@/lib/api/leave";
import { titleCase } from "@/lib/api/employees";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/hrm/page-header";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { ConfirmDialog } from "@/components/hrm/confirm-dialog";
import { EmptyState } from "@/components/hrm/empty-state";
import { CardSkeleton, TableSkeleton } from "@/components/hrm/loading-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function LeavePage() {
  const balances = useAsync(getLeaveBalances);
  const requests = useAsync(getMyLeaveRequests);
  const [cancelId, setCancelId] = React.useState<string | null>(null);

  async function handleCancel() {
    if (!cancelId) return;
    await cancelLeaveRequest(cancelId);
    toast.success("Leave request cancelled");
    requests.refetch();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave"
        description="Your balance and leave request history."
        actions={
          <Button asChild size="sm">
            <Link href="/leave/apply">
              <CalendarPlus />
              Apply leave
            </Link>
          </Button>
        }
      />

      <AsyncSection
        loading={balances.loading}
        error={balances.error}
        onRetry={balances.refetch}
        loadingFallback={
          <div className="grid gap-4 sm:grid-cols-3">
            <CardSkeleton lines={2} />
            <CardSkeleton lines={2} />
            <CardSkeleton lines={2} />
          </div>
        }
      >
        {balances.data && (
          <div className="grid gap-4 sm:grid-cols-3">
            {balances.data.map((b) => {
              const total = b.allocatedDays + b.carriedOverDays;
              return (
                <Card key={b.leaveTypeId}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{b.leaveTypeName}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-2xl font-semibold tabular-nums">
                      {b.remainingDays}
                      <span className="text-muted-foreground ml-1 text-sm font-normal">
                        / {total} days left
                      </span>
                    </p>
                    <Progress value={total > 0 ? (b.usedDays / total) * 100 : 0} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </AsyncSection>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your requests</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncSection
            loading={requests.loading}
            error={requests.error}
            onRetry={requests.refetch}
            loadingFallback={<TableSkeleton rows={3} columns={4} />}
          >
            {(requests.data ?? []).length === 0 ? (
              <EmptyState
                icon={CalendarPlus}
                title="No leave requests yet"
                description="Apply for leave and it will show up here."
                action={
                  <Button size="sm" asChild>
                    <Link href="/leave/apply">Apply leave</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y">
                {(requests.data ?? []).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {r.leaveType.name} · {titleCase(r.dayType)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {r.startDate === r.endDate
                          ? formatDate(r.startDate)
                          : `${formatDate(r.startDate)} - ${formatDate(r.endDate)}`}{" "}
                        · {r.totalDays} day{r.totalDays !== 1 ? "s" : ""} · {r.reason}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={titleCase(r.status)} />
                      {r.status === "PENDING" && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Cancel request"
                          onClick={() => setCancelId(r.id)}
                        >
                          <Ban className="text-muted-foreground size-4" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </AsyncSection>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!cancelId}
        onOpenChange={(open) => !open && setCancelId(null)}
        title="Cancel this leave request?"
        description="Your manager will no longer see this request for approval."
        confirmLabel="Cancel request"
        variant="destructive"
        onConfirm={handleCancel}
      />
    </div>
  );
}
