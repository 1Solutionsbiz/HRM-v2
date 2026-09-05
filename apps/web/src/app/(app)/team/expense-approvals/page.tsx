"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Receipt, X } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import {
  getCompanyExpenseClaims,
  decideExpenseClaim,
  type CompanyExpenseClaim,
} from "@/lib/api/expenses";
import { employeeFullName, employeeInitials, titleCase } from "@/lib/api/employees";
import { formatDate, formatINR } from "@/lib/format";
import { PageHeader } from "@/components/hrm/page-header";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { TableSkeleton } from "@/components/hrm/loading-state";
import { ConfirmDialog } from "@/components/hrm/confirm-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ExpenseApprovalsPage() {
  const claims = useAsync(getCompanyExpenseClaims);
  const [rejectTarget, setRejectTarget] = React.useState<CompanyExpenseClaim | null>(null);
  const [decidingId, setDecidingId] = React.useState<string | null>(null);

  const pending = (claims.data ?? []).filter((c) => c.status === "PENDING");
  const decided = (claims.data ?? []).filter((c) => c.status !== "PENDING");

  async function handleApprove(c: CompanyExpenseClaim) {
    setDecidingId(c.id);
    try {
      await decideExpenseClaim(c.id, "APPROVED");
      toast.success(`${employeeFullName(c.employee)}'s expense claim approved`);
      claims.refetch();
    } catch {
      toast.error("Couldn't approve this claim. Please try again.");
    } finally {
      setDecidingId(null);
    }
  }

  async function handleReject() {
    if (!rejectTarget) return;
    setDecidingId(rejectTarget.id);
    try {
      await decideExpenseClaim(rejectTarget.id, "REJECTED");
      toast.success(`${employeeFullName(rejectTarget.employee)}'s expense claim rejected`);
      claims.refetch();
    } catch {
      toast.error("Couldn't reject this claim. Please try again.");
    } finally {
      setDecidingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Expense approvals" description="Approve or decline your team's expense claims." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncSection
            loading={claims.loading}
            error={claims.error}
            onRetry={claims.refetch}
            loadingFallback={<TableSkeleton rows={3} columns={4} />}
          >
            {pending.length === 0 ? (
              <EmptyState icon={Receipt} title="No pending expense claims" />
            ) : (
              <ul className="divide-y">
                {pending.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-3">
                    <Avatar className="size-8 shrink-0">
                      <AvatarFallback className="text-xs">{employeeInitials(c.employee)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{employeeFullName(c.employee)}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {c.category.name} · {formatDate(c.expenseDate)} · {formatINR(c.amount)}
                      </p>
                      <p className="text-muted-foreground truncate text-xs italic">{c.description}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-success hover:text-success"
                        aria-label="Approve"
                        disabled={decidingId === c.id}
                        onClick={() => handleApprove(c)}
                      >
                        <Check className="size-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        aria-label="Reject"
                        disabled={decidingId === c.id}
                        onClick={() => setRejectTarget(c)}
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
            loading={claims.loading}
            error={claims.error}
            onRetry={claims.refetch}
            loadingFallback={<TableSkeleton rows={3} columns={4} />}
          >
            {decided.length === 0 ? (
              <EmptyState icon={Receipt} title="No decided claims yet" />
            ) : (
              <ul className="divide-y">
                {decided.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-3">
                    <Avatar className="size-8 shrink-0">
                      <AvatarFallback className="text-xs">{employeeInitials(c.employee)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{employeeFullName(c.employee)}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {c.category.name} · {formatDate(c.expenseDate)} · {formatINR(c.amount)}
                      </p>
                    </div>
                    <StatusBadge status={titleCase(c.status)} className="shrink-0" />
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
        title="Reject this expense claim?"
        description={
          rejectTarget
            ? `${employeeFullName(rejectTarget.employee)}'s ${rejectTarget.category.name.toLowerCase()} claim will be marked as rejected.`
            : ""
        }
        confirmLabel="Reject"
        variant="destructive"
        onConfirm={handleReject}
      />
    </div>
  );
}
