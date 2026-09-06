"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { monthName } from "@/lib/api/payroll";
import { formatDate } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface LeaveMonthTableRequest {
  id: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  /** Shown only when a table aggregates more than one leave type. */
  leaveTypeName?: string;
}

export interface LeaveMonthTableMonth {
  month: number;
  leavesTaken: number;
  balance: number;
  requests: LeaveMonthTableRequest[];
}

// Shared by LeaveLedgerSheet (one leave type at a time) and
// EmployeeLeaveHistorySheet (all leave types combined) so the two entry
// points render this table identically.
export function LeaveMonthTable({ months }: { months: LeaveMonthTableMonth[] }) {
  const [expandedMonth, setExpandedMonth] = React.useState<number | null>(null);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Leave month name</TableHead>
          <TableHead className="text-right">Leaves taken</TableHead>
          <TableHead className="text-right">Balance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {months.map((m) => {
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
                      <p className="text-muted-foreground py-2 text-xs">No leave taken this month.</p>
                    ) : (
                      <ul className="divide-y">
                        {m.requests.map((r) => (
                          <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                            <div className="min-w-0">
                              <p className="font-medium">
                                {formatDate(r.startDate)}
                                {r.startDate !== r.endDate && ` – ${formatDate(r.endDate)}`}
                                {r.leaveTypeName && ` · ${r.leaveTypeName}`}
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
  );
}
