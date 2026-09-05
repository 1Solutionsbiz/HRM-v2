"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Ban, Plus, Receipt } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { getMyExpenseClaims, cancelExpenseClaim } from "@/lib/api/expenses";
import { titleCase } from "@/lib/api/employees";
import { formatDate, formatINR } from "@/lib/format";
import { PageHeader } from "@/components/hrm/page-header";
import { StatusBadge } from "@/components/hrm/status-badge";
import { StatCard } from "@/components/hrm/stat-card";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { ConfirmDialog } from "@/components/hrm/confirm-dialog";
import { StatGridSkeleton, TableSkeleton } from "@/components/hrm/loading-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ExpensesPage() {
  const { data, loading, error, refetch } = useAsync(getMyExpenseClaims);
  const [cancelId, setCancelId] = React.useState<string | null>(null);

  const pending = (data ?? []).filter((e) => e.status === "PENDING");
  const approved = (data ?? []).filter((e) => e.status === "APPROVED");
  const totalApproved = approved.reduce((sum, e) => sum + e.amount, 0);

  async function handleCancel() {
    if (!cancelId) return;
    try {
      await cancelExpenseClaim(cancelId);
      toast.success("Expense claim cancelled");
      refetch();
    } catch {
      toast.error("Couldn't cancel this claim. Please try again.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Submit and track your reimbursement claims."
        actions={
          <Button asChild size="sm">
            <Link href="/expenses/add">
              <Plus />
              Add expense
            </Link>
          </Button>
        }
      />

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={refetch}
        loadingFallback={<StatGridSkeleton count={3} />}
      >
        {data && (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Pending claims" value={String(pending.length)} icon={Receipt} />
            <StatCard
              label="Pending amount"
              value={formatINR(pending.reduce((s, e) => s + e.amount, 0))}
            />
            <StatCard label="Approved (reimbursed)" value={formatINR(totalApproved)} />
          </div>
        )}
      </AsyncSection>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your claims</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncSection
            loading={loading}
            error={error}
            onRetry={refetch}
            loadingFallback={<TableSkeleton rows={4} columns={4} />}
          >
            {(data ?? []).length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No expense claims yet"
                description="Submit a claim and it will show up here."
                action={
                  <Button size="sm" asChild>
                    <Link href="/expenses/add">Add expense</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y">
                {(data ?? []).map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{e.category.name}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {formatDate(e.expenseDate)} · {e.description}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-medium tabular-nums">{formatINR(e.amount)}</span>
                      <StatusBadge status={titleCase(e.status)} />
                      {e.status === "PENDING" && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Cancel claim"
                          onClick={() => setCancelId(e.id)}
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
        title="Cancel this expense claim?"
        description="Your approver will no longer see this claim for review."
        confirmLabel="Cancel claim"
        variant="destructive"
        onConfirm={handleCancel}
      />
    </div>
  );
}
