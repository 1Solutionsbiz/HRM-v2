"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { type CompanyLeaveRequest } from "@/lib/api/leave";
import { titleCase } from "@/lib/api/employees";
import { monthName } from "@/lib/api/payroll";
import { formatDate } from "@/lib/format";
import { EmptyState } from "@/components/hrm/empty-state";
import { StatusBadge } from "@/components/hrm/status-badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

interface EmployeeLeaveHistorySheetProps {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  requests: CompanyLeaveRequest[];
  onOpenChange: (open: boolean) => void;
}

export function EmployeeLeaveHistorySheet({
  employeeId,
  employeeName,
  employeeCode,
  requests,
  onOpenChange,
}: EmployeeLeaveHistorySheetProps) {
  const now = new Date();
  const [month, setMonth] = React.useState(now.getMonth() + 1);
  const [year, setYear] = React.useState(now.getFullYear());

  const employeeRequests = requests.filter((r) => r.employee.id === employeeId);
  const years = Array.from(
    new Set([now.getFullYear(), ...employeeRequests.map((r) => new Date(r.startDate).getUTCFullYear())]),
  ).sort((a, b) => b - a);

  const monthRequests = employeeRequests
    .filter((r) => {
      const start = new Date(r.startDate);
      return start.getUTCMonth() + 1 === month && start.getUTCFullYear() === year;
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Leave history</SheetTitle>
          <SheetDescription>
            {employeeName} ({employeeCode})
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4">
          <div className="flex gap-3">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {monthName(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {monthRequests.length === 0 ? (
            <EmptyState
              size="sm"
              icon={CalendarDays}
              title={`No leave requests in ${monthName(month)} ${year}`}
            />
          ) : (
            <ul className="divide-y">
              {monthRequests.map((r) => (
                <li key={r.id} className="space-y-1 py-3 first:pt-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{r.leaveType.name}</p>
                    <StatusBadge status={titleCase(r.status)} />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {formatDate(r.startDate)}
                    {r.startDate !== r.endDate && ` – ${formatDate(r.endDate)}`} · {r.totalDays}d
                  </p>
                  <p className="text-muted-foreground text-xs">{r.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
