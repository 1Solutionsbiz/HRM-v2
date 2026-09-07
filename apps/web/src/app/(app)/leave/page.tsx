"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarPlus, Ban } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { getLeaveBalances, getLeaveLedger, getMyLeaveRequests, cancelLeaveRequest, type LeaveLedgerRequest } from "@/lib/api/leave";
import { titleCase } from "@/lib/api/employees";
import { formatDate, formatDateShort } from "@/lib/format";
import { monthName } from "@/lib/api/payroll";
import { PageHeader } from "@/components/hrm/page-header";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { ConfirmDialog } from "@/components/hrm/confirm-dialog";
import { CardSkeleton, TableSkeleton } from "@/components/hrm/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface LedgerRow extends LeaveLedgerRequest {
  month: number;
}

export default function LeavePage() {
  const balances = useAsync(getLeaveBalances);
  const ledger = useAsync(() => getLeaveLedger());
  const requests = useAsync(getMyLeaveRequests);
  const [cancelId, setCancelId] = React.useState<string | null>(null);
  const pendingRequests = (requests.data ?? []).filter((r) => r.status === "PENDING");

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
        description="Your balance and leave history."
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

      {pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending requests</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {pendingRequests.map((r) => (
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
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Cancel request"
                      onClick={() => setCancelId(r.id)}
                    >
                      <Ban className="text-muted-foreground size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <AsyncSection
        loading={ledger.loading}
        error={ledger.error}
        onRetry={ledger.refetch}
        loadingFallback={<TableSkeleton rows={5} columns={4} />}
      >
        {(ledger.data ?? [])
          .filter((type) => type.months.some((m) => m.requests.length > 0))
          .map((type) => {
            const rows: LedgerRow[] = type.months
              .flatMap((m) => m.requests.map((r) => ({ ...r, month: m.month })))
              .sort((a, b) => b.startDate.localeCompare(a.startDate));

            return (
              <Card key={type.leaveTypeId}>
                <CardHeader>
                  <CardTitle className="flex items-baseline gap-2 text-base">
                    {type.leaveTypeName}
                    <span className="text-muted-foreground text-sm font-normal">
                      Current balance: {type.remainingDays}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Leave month name</TableHead>
                        <TableHead>Leave date</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead className="text-right">Type of leave</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{monthName(r.month)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {r.startDate === r.endDate
                              ? formatDateShort(r.startDate)
                              : `${formatDateShort(r.startDate)} – ${formatDateShort(r.endDate)}`}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{r.balanceAfter}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">{titleCase(r.dayType)}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}

        {(ledger.data ?? []).every((type) => type.months.every((m) => m.requests.length === 0)) && (
          <Card>
            <CardContent className="pt-6">
              <EmptyState
                icon={CalendarPlus}
                title="No leave taken yet this year"
                description="Apply for leave and it will show up here."
                action={
                  <Button size="sm" asChild>
                    <Link href="/leave/apply">Apply leave</Link>
                  </Button>
                }
              />
            </CardContent>
          </Card>
        )}
      </AsyncSection>

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
