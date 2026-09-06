"use client";

import * as React from "react";
import { useAsync } from "@/lib/use-async";
import { getEmployeeLeaveLedger } from "@/lib/api/leave";
import { AsyncSection } from "@/components/hrm/async-section";
import { LeaveMonthTable } from "@/components/hrm/leave-month-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

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
                    onClick={() => setSelectedTypeId(l.leaveTypeId)}
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
                <LeaveMonthTable months={selected.months} />
              </>
            )}
          </AsyncSection>
        </div>
      </SheetContent>
    </Sheet>
  );
}
