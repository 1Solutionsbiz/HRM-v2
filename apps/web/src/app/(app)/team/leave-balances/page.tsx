"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { getCompanyLeaveBalances, getCompanyLeaveRequests, type CompanyLeaveBalanceRow } from "@/lib/api/leave";
import { PageHeader } from "@/components/hrm/page-header";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { TableSkeleton } from "@/components/hrm/loading-state";
import { EmployeeLeaveHistorySheet } from "@/components/hrm/employee-leave-history-sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export default function TeamLeaveBalancesPage() {
  const { data, loading, error, refetch } = useAsync(getCompanyLeaveBalances);
  const requests = useAsync(getCompanyLeaveRequests);
  const [selected, setSelected] = React.useState<CompanyLeaveBalanceRow | null>(null);
  const rows = data ?? [];
  const leaveTypes = rows[0]?.balances ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Leave balances" description="Current leave balance for every active employee." />

      <Card>
        <CardContent className="pt-6">
          <AsyncSection
            loading={loading}
            error={error}
            onRetry={refetch}
            loadingFallback={<TableSkeleton rows={7} columns={4} />}
          >
            {rows.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No active employees" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    {leaveTypes.map((lt) => (
                      <TableHead key={lt.leaveTypeId} className="text-right">
                        {lt.leaveTypeName}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.employeeId}>
                      <TableCell>
                        <button
                          type="button"
                          className="flex min-w-0 items-center gap-2.5 text-left"
                          onClick={() => setSelected(r)}
                        >
                          <Avatar className="size-8 shrink-0">
                            {r.avatarUrl && <AvatarImage src={r.avatarUrl} alt="" />}
                            <AvatarFallback className="text-xs">{initials(r.firstName, r.lastName)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium hover:underline">
                              {r.firstName} {r.lastName}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {r.employeeCode} · {r.designation?.title ?? "—"}
                            </p>
                          </div>
                        </button>
                      </TableCell>
                      {r.balances.map((b) => (
                        <TableCell key={b.leaveTypeId} className="text-right tabular-nums">
                          {b.remainingDays}
                          <span className="text-muted-foreground">
                            {" "}
                            / {b.allocatedDays + b.carriedOverDays}
                          </span>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </AsyncSection>
        </CardContent>
      </Card>

      {selected && (
        <EmployeeLeaveHistorySheet
          employeeId={selected.employeeId}
          employeeName={`${selected.firstName} ${selected.lastName}`}
          employeeCode={selected.employeeCode}
          requests={requests.data ?? []}
          onOpenChange={(open) => !open && setSelected(null)}
        />
      )}
    </div>
  );
}
