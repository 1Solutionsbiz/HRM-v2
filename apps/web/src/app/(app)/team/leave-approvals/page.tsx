"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, ClipboardList, X } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { getCompanyLeaveRequests, decideLeaveRequest, type CompanyLeaveRequest } from "@/lib/api/leave";
import { employeeFullName, employeeInitials, titleCase } from "@/lib/api/employees";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/hrm/page-header";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { TableSkeleton } from "@/components/hrm/loading-state";
import { ConfirmDialog } from "@/components/hrm/confirm-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LeaveApprovalsPage() {
  const requests = useAsync(getCompanyLeaveRequests);
  const [rejectTarget, setRejectTarget] = React.useState<CompanyLeaveRequest | null>(null);
  const [decidingId, setDecidingId] = React.useState<string | null>(null);

  const pending = (requests.data ?? []).filter((r) => r.status === "PENDING");
  const decided = (requests.data ?? []).filter((r) => r.status !== "PENDING");

  async function handleApprove(r: CompanyLeaveRequest) {
    setDecidingId(r.id);
    try {
      await decideLeaveRequest(r.id, "APPROVED");
      toast.success(`${employeeFullName(r.employee)}'s leave request approved`);
      requests.refetch();
    } catch {
      toast.error("Couldn't approve this request. Please try again.");
    } finally {
      setDecidingId(null);
    }
  }

  async function handleReject() {
    if (!rejectTarget) return;
    setDecidingId(rejectTarget.id);
    try {
      await decideLeaveRequest(rejectTarget.id, "REJECTED");
      toast.success(`${employeeFullName(rejectTarget.employee)}'s leave request rejected`);
      requests.refetch();
    } catch {
      toast.error("Couldn't reject this request. Please try again.");
    } finally {
      setDecidingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Leave approvals" description="Approve or decline your team's leave requests." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncSection
            loading={requests.loading}
            error={requests.error}
            onRetry={requests.refetch}
            loadingFallback={<TableSkeleton rows={3} columns={4} />}
          >
            {pending.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No pending leave requests" />
            ) : (
              <ul className="divide-y">
                {pending.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-3">
                    <Avatar className="size-8 shrink-0">
                      <AvatarFallback className="text-xs">{employeeInitials(r.employee)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{employeeFullName(r.employee)}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {r.leaveType.name} · {titleCase(r.dayType)} ·{" "}
                        {r.startDate === r.endDate
                          ? formatDate(r.startDate)
                          : `${formatDate(r.startDate)} - ${formatDate(r.endDate)}`}{" "}
                        · {r.totalDays} day{r.totalDays !== 1 ? "s" : ""}
                      </p>
                      <p className="text-muted-foreground truncate text-xs italic">{r.reason}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-success hover:text-success"
                        aria-label="Approve"
                        disabled={decidingId === r.id}
                        onClick={() => handleApprove(r)}
                      >
                        <Check className="size-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        aria-label="Reject"
                        disabled={decidingId === r.id}
                        onClick={() => setRejectTarget(r)}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncSection
            loading={requests.loading}
            error={requests.error}
            onRetry={requests.refetch}
            loadingFallback={<TableSkeleton rows={3} columns={4} />}
          >
            {decided.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No decided requests yet" />
            ) : (
              <ul className="divide-y">
                {decided.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-3">
                    <Avatar className="size-8 shrink-0">
                      <AvatarFallback className="text-xs">{employeeInitials(r.employee)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{employeeFullName(r.employee)}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {r.leaveType.name} ·{" "}
                        {r.startDate === r.endDate
                          ? formatDate(r.startDate)
                          : `${formatDate(r.startDate)} - ${formatDate(r.endDate)}`}{" "}
                        · {r.totalDays} day{r.totalDays !== 1 ? "s" : ""}
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

      <ConfirmDialog
        open={!!rejectTarget}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        title="Reject this leave request?"
        description={
          rejectTarget
            ? `${employeeFullName(rejectTarget.employee)}'s ${rejectTarget.leaveType.name.toLowerCase()} request will be marked as rejected.`
            : ""
        }
        confirmLabel="Reject"
        variant="destructive"
        onConfirm={handleReject}
      />
    </div>
  );
}
