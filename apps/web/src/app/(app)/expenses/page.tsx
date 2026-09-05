"use client";

import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { getExpenseClaims } from "@/lib/mock/mock-api";
import { formatDate, formatINR } from "@/lib/format";
import { PageHeader } from "@/components/hrm/page-header";
import { StatusBadge } from "@/components/hrm/status-badge";
import { StatCard } from "@/components/hrm/stat-card";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { StatGridSkeleton, TableSkeleton } from "@/components/hrm/loading-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ExpensesPage() {
  const { data, loading, error, refetch } = useAsync(getExpenseClaims);

  const pending = (data ?? []).filter((e) => e.status === "Pending");
  const approvedThisMonth = (data ?? []).filter((e) => e.status === "Approved");
  const totalApproved = approvedThisMonth.reduce((sum, e) => sum + e.amount, 0);

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
                      <p className="truncate text-sm font-medium">{e.category}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {formatDate(e.date)} · {e.description}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-medium tabular-nums">{formatINR(e.amount)}</span>
                      <StatusBadge status={e.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </AsyncSection>
        </CardContent>
      </Card>
    </div>
  );
}
