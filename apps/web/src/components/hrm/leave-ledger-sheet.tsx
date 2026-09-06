"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { getEmployeeLeaveLedger } from "@/lib/api/leave";
import { monthName } from "@/lib/api/payroll";
import { formatDate } from "@/lib/format";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface LeaveLedgerSheetProps {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  leaveTypeId: string;
  onOpenChange: (open: boolean) => void;
}

// Opens on the balance card's leave-type name (see the Leave tab). No
// monthly accrual schedule exists (see the backend's own comment), so this
// only ever shows real approved usage grouped by month, plus a running
// balance derived from it - not an accrual ledger.
export function LeaveLedgerSheet({
  employeeId,
  employeeName,
  employeeCode,
  leaveTypeId,
  onOpenChange,
}: LeaveLedgerSheetProps) {
  const { data, loading, error, refetch } = useAsync(
    () => getEmployeeLeaveLedger(employeeId),
    [employeeId],
  );
  const [expandedMonth, setExpandedMonth] = React.useState<number | null>(null);
  const [selectedTypeId, setSelectedTypeId] = React.useState(leaveTypeId);

  const selected = (data ?? []).find((l) => l.leaveTypeId === selectedTypeId);

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Leave balance</SheetTitle>
          <SheetDescription>
            {employeeName} ({employeeCode})
          </SheetDescription>
        </SheetHeader>

        <div className="px-4">
          <AsyncSection
            loading={loading}
            error={error}
            onRetry={refetch}
            loadingFallback={<Skeleton className="h-64 w-full" />}
          >
            {(data ?? []).length > 1 && (
              <div className="mb-4 flex flex-wrap gap-1 rounded-lg border p-1">
                {(data ?? []).map((l) => (
                  <Button
                    key={l.leaveTypeId}
                    size="sm"
                    variant={l.leaveTypeId === selectedTypeId ? "default" : "ghost"}
                    onClick={() => {
                      setSelectedTypeId(l.leaveTypeId);
                      setExpandedMonth(null);
                    }}
                  >
                    {l.leaveTypeName}
                  </Button>
                ))}
              </div>
            )}

            {selected && (
              <>
                <h3 className="text-base font-semibold">{selected.leaveTypeName}</h3>
                <p className="text-success mb-4 text-sm font-medium">
                  Current leave balance: {selected.remainingDays}
                </p>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Leave month name</TableHead>
                      <TableHead className="text-right">Leaves taken</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selected.months.map((m) => {
                      const expanded = expandedMonth === m.month;
                      return (
                        <React.Fragment key={m.month}>
                          <TableRow
                            className="cursor-pointer"
                            onClick={() => setExpandedMonth(expanded ? null : m.month)}
                          >
                            <TableCell>
                              <span className="flex items-center gap-1.5">
                                {expanded ? (
                                  <ChevronDown className="text-muted-foreground size-3.5" />
                                ) : (
                                  <ChevronRight className="text-muted-foreground size-3.5" />
                                )}
                                {monthName(m.month).slice(0, 3)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{m.leavesTaken}</TableCell>
                            <TableCell className="text-right tabular-nums">{m.balance}</TableCell>
                          </TableRow>
                          {expanded && (
                            <TableRow>
                              <TableCell colSpan={3} className="bg-muted/30">
                                {m.requests.length === 0 ? (
                                  <p className="text-muted-foreground py-2 text-xs">
                                    No leave taken this month.
                                  </p>
                                ) : (
                                  <ul className="divide-y">
                                    {m.requests.map((r) => (
                                      <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                                        <div className="min-w-0">
                                          <p className="font-medium">
                                            {formatDate(r.startDate)}
                                            {r.startDate !== r.endDate && ` – ${formatDate(r.endDate)}`}
                                          </p>
                                          <p className="text-muted-foreground truncate">{r.reason}</p>
                                        </div>
                                        <span className="text-muted-foreground shrink-0">{r.totalDays}d</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>

                {selected.months.length === 0 && (
                  <EmptyState size="sm" title="No data for this year yet" />
                )}
              </>
            )}
          </AsyncSection>
        </div>
      </SheetContent>
    </Sheet>
  );
}
