"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Calendar as CalendarIcon, CheckCircle2, Clock, UserX, X } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import {
  getCompanyAttendance,
  getEmployeeAttendanceHistory,
  type AttendanceHistoryDay,
} from "@/lib/api/attendance";
import { getEmployees, titleCase, type EmployeeListItem } from "@/lib/api/employees";
import { formatDate, formatTime, toDateOnlyString } from "@/lib/format";
import { PageHeader } from "@/components/hrm/page-header";
import { StatCard } from "@/components/hrm/stat-card";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { EmployeePicker } from "@/components/hrm/employee-picker";
import { StatGridSkeleton, TableSkeleton } from "@/components/hrm/loading-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { DatePicker } from "@/components/ui/date-picker";

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

type Period = "day" | "week" | "month" | "quarter";

const PERIODS: { value: Period; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
];

function rangeForPeriod(period: Period, ref: Date): { from: string; to: string } {
  if (period === "day") {
    const s = toDateOnlyString(ref);
    return { from: s, to: s };
  }
  if (period === "week") {
    const day = ref.getDay(); // 0 = Sun .. 6 = Sat
    const monday = new Date(ref);
    monday.setDate(ref.getDate() + (day === 0 ? -6 : 1 - day));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: toDateOnlyString(monday), to: toDateOnlyString(sunday) };
  }
  if (period === "month") {
    const first = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    return { from: toDateOnlyString(first), to: toDateOnlyString(last) };
  }
  const quarterStartMonth = Math.floor(ref.getMonth() / 3) * 3;
  const first = new Date(ref.getFullYear(), quarterStartMonth, 1);
  const last = new Date(ref.getFullYear(), quarterStartMonth + 3, 0);
  return { from: toDateOnlyString(first), to: toDateOnlyString(last) };
}

function EmployeeHistoryView({ employee, onClear }: { employee: EmployeeListItem; onClear: () => void }) {
  const [period, setPeriod] = React.useState<Period>("week");
  const [refDate, setRefDate] = React.useState<Date>(new Date());
  const { from, to } = React.useMemo(() => rangeForPeriod(period, refDate), [period, refDate]);

  const { data, loading, error, refetch } = useAsync(
    () => getEmployeeAttendanceHistory(employee.id, { from, to }),
    [employee.id, from, to],
  );

  const columns: ColumnDef<AttendanceHistoryDay>[] = [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => formatDate(row.original.date, { weekday: "short", day: "numeric", month: "short" }),
    },
    {
      accessorKey: "firstCheckInAt",
      header: "Check in",
      cell: ({ row }) => (row.original.firstCheckInAt ? formatTime(row.original.firstCheckInAt) : "—"),
    },
    {
      accessorKey: "lastCheckOutAt",
      header: "Check out",
      cell: ({ row }) => (row.original.lastCheckOutAt ? formatTime(row.original.lastCheckOutAt) : "—"),
    },
    {
      accessorKey: "workedMinutes",
      header: "Hours",
      cell: ({ row }) =>
        row.original.workedMinutes != null ? `${(row.original.workedMinutes / 60).toFixed(1)}h` : "—",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={titleCase(row.original.status)} />,
    },
  ];

  const rows = data ?? [];
  const present = rows.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
  const absent = rows.filter((r) => r.status === "ABSENT").length;
  const totalHours = rows.reduce((sum, r) => sum + (r.workedMinutes ?? 0), 0) / 60;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="size-9 shrink-0">
              <AvatarFallback className="text-xs">{initials(employee.firstName, employee.lastName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {employee.firstName} {employee.lastName}
              </p>
              <p className="text-muted-foreground text-xs">
                {employee.employeeCode} · {employee.designation?.title ?? "—"} · {employee.department?.name ?? "—"}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X />
            Back to team roster
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg border p-1">
          {PERIODS.map((p) => (
            <Button
              key={p.value}
              size="sm"
              variant={period === p.value ? "default" : "ghost"}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <CalendarIcon className="text-muted-foreground size-4" />
          <DatePicker value={refDate} onChange={(d) => d && setRefDate(d)} />
        </div>
      </div>

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={refetch}
        loadingFallback={<StatGridSkeleton count={3} />}
      >
        {data && (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Present" value={String(present)} icon={CheckCircle2} tone="success" />
            <StatCard label="Absent" value={String(absent)} icon={UserX} />
            <StatCard label="Total hours" value={totalHours.toFixed(1)} icon={Clock} />
          </div>
        )}
      </AsyncSection>

      <Card>
        <CardContent className="pt-6">
          <AsyncSection
            loading={loading}
            error={error}
            onRetry={refetch}
            loadingFallback={<TableSkeleton rows={7} columns={5} />}
          >
            <DataTable
              columns={columns}
              data={rows}
              emptyTitle="No attendance in this range"
              pageSize={15}
            />
          </AsyncSection>
        </CardContent>
      </Card>
    </div>
  );
}

function TeamRosterView({
  employees,
  onSelectEmployee,
}: {
  employees: EmployeeListItem[];
  onSelectEmployee: (employee: EmployeeListItem) => void;
}) {
  const [date, setDate] = React.useState<Date>(new Date());
  const dateStr = toDateOnlyString(date);

  const { data, loading, error, refetch } = useAsync(() => getCompanyAttendance(dateStr), [dateStr]);

  const rows = data ?? [];
  const present = rows.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
  const late = rows.filter((r) => r.status === "LATE").length;
  const absent = rows.filter((r) => r.status === "ABSENT").length;
  const onLeave = rows.filter((r) => r.status === "ON_LEAVE").length;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <DatePicker value={date} onChange={(d) => d && setDate(d)} />
      </div>

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={refetch}
        loadingFallback={<StatGridSkeleton count={4} />}
      >
        {data && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Present" value={String(present)} icon={CheckCircle2} tone="success" />
            <StatCard label="Late" value={String(late)} icon={Clock} tone="warning" />
            <StatCard label="Absent" value={String(absent)} icon={UserX} />
            <StatCard label="On leave" value={String(onLeave)} />
          </div>
        )}
      </AsyncSection>

      <Card>
        <CardContent className="pt-6">
          <AsyncSection
            loading={loading}
            error={error}
            onRetry={refetch}
            loadingFallback={<TableSkeleton rows={8} columns={5} />}
          >
            {rows.length === 0 ? (
              <EmptyState icon={Clock} title="No active employees" />
            ) : (
              <ul className="divide-y">
                {rows.map((r) => {
                  const employee = employees.find((e) => e.id === r.employeeId);
                  return (
                    <li key={r.employeeId} className="flex items-center gap-3 py-3">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                        onClick={() => employee && onSelectEmployee(employee)}
                        disabled={!employee}
                      >
                        <Avatar className="size-8 shrink-0">
                          <AvatarFallback className="text-xs">{initials(r.firstName, r.lastName)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium hover:underline">
                            {r.firstName} {r.lastName}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {r.designation?.title ?? "—"} · {r.department?.name ?? "—"}
                          </p>
                        </div>
                      </button>
                      <div className="text-muted-foreground hidden shrink-0 text-xs sm:block">
                        {r.firstCheckInAt ? formatTime(r.firstCheckInAt) : "—"} -{" "}
                        {r.lastCheckOutAt ? formatTime(r.lastCheckOutAt) : "—"}
                        {r.workedMinutes != null && ` · ${(r.workedMinutes / 60).toFixed(1)}h`}
                      </div>
                      <StatusBadge status={titleCase(r.status)} className="shrink-0" />
                    </li>
                  );
                })}
              </ul>
            )}
          </AsyncSection>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TeamAttendancePage() {
  const { data: employees } = useAsync(getEmployees);
  const activeEmployees = React.useMemo(
    () => (employees ?? []).filter((e) => e.status === "ACTIVE"),
    [employees],
  );
  const [selected, setSelected] = React.useState<EmployeeListItem | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team attendance"
        description="Review your team's daily attendance."
        actions={<EmployeePicker employees={activeEmployees} onSelect={setSelected} />}
      />

      {selected ? (
        <EmployeeHistoryView employee={selected} onClear={() => setSelected(null)} />
      ) : (
        <TeamRosterView employees={activeEmployees} onSelectEmployee={setSelected} />
      )}
    </div>
  );
}
