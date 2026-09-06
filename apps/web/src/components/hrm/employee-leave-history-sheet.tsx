"use client";

import { useAsync } from "@/lib/use-async";
import { getEmployeeLeaveLedger } from "@/lib/api/leave";
import { AsyncSection } from "@/components/hrm/async-section";
import { LeaveMonthTable, type LeaveMonthTableMonth } from "@/components/hrm/leave-month-table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface EmployeeLeaveHistorySheetProps {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  onOpenChange: (open: boolean) => void;
}

// Same month-by-month table as the per-leave-type Leave tab drill-down
// (LeaveLedgerSheet), but combined across every leave type into one view -
// this entry point (the company-wide roster) doesn't ask which type first.
export function EmployeeLeaveHistorySheet({
  employeeId,
  employeeName,
  employeeCode,
  onOpenChange,
}: EmployeeLeaveHistorySheetProps) {
  const { data, loading, error, refetch } = useAsync(
    () => getEmployeeLeaveLedger(employeeId),
    [employeeId],
  );

  const ledgers = data ?? [];
  const currentBalance = ledgers.reduce((sum, l) => sum + l.remainingDays, 0);
  const monthCount = Math.max(0, ...ledgers.map((l) => l.months.length));
  const months: LeaveMonthTableMonth[] = Array.from({ length: monthCount }, (_, i) => {
    const monthNumber = i + 1;
    return {
      month: monthNumber,
      leavesTaken: ledgers.reduce((sum, l) => sum + (l.months[i]?.leavesTaken ?? 0), 0),
      balance: ledgers.reduce((sum, l) => sum + (l.months[i]?.balance ?? 0), 0),
      requests: ledgers.flatMap((l) =>
        (l.months[i]?.requests ?? []).map((r) => ({ ...r, leaveTypeName: l.leaveTypeName })),
      ),
    };
  });

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Leave history</SheetTitle>
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
            <p className="text-success mb-4 text-sm font-medium">
              Current leave balance: {currentBalance}
            </p>
            <LeaveMonthTable months={months} />
          </AsyncSection>
        </div>
      </SheetContent>
    </Sheet>
  );
}
