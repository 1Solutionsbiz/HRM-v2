"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { AlarmClock, Calendar as CalendarIcon, CheckCircle2, Clock, UserX, X } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { ApiError } from "@/lib/api-client";
import {
  getCompanyAttendance,
  getEmployeeAttendanceHistory,
  recordAttendanceCorrection,
  sendMissingCheckoutReminderTest,
  type AttendanceHistoryDay,
  type CompanyAttendanceRow,
} from "@/lib/api/attendance";
import { getEmployees, titleCase, type EmployeeListItem } from "@/lib/api/employees";
import { formatDate, formatTime, toDateOnlyString } from "@/lib/format";
import { rangeForPeriod, PERIODS, type Period } from "@/lib/period";
import { PageHeader } from "@/components/hrm/page-header";
import { StatCard } from "@/components/hrm/stat-card";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { EmployeePicker } from "@/components/hrm/employee-picker";
import { ConfirmDialog } from "@/components/hrm/confirm-dialog";
import { StatGridSkeleton, TableSkeleton } from "@/components/hrm/loading-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function EmployeeHistoryView({ employee, onClear }: { employee: EmployeeListItem; onClear: () => void }) {
  const [period, setPeriod] = React.useState<Period>("month");
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
  const present = rows.filter((r) => r.status === "PRESENT").length;
  const absent = rows.filter((r) => r.status === "ABSENT").length;
  const late = rows.filter((r) => r.status === "LATE").length;
  const totalHours = rows.reduce((sum, r) => sum + (r.workedMinutes ?? 0), 0) / 60;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="size-9 shrink-0">
              {employee.avatarUrl && <AvatarImage src={employee.avatarUrl} alt="" />}
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
          <div className="grid grid-cols-4 gap-1.5 sm:gap-4">
            <StatCard
              label="Present"
              value={String(present)}
              icon={CheckCircle2}
              tone="success"
              className="[--card-spacing:--spacing(2)] sm:[--card-spacing:--spacing(4)]"
            />
            <StatCard
              label="Absent"
              value={String(absent)}
              icon={UserX}
              className="[--card-spacing:--spacing(2)] sm:[--card-spacing:--spacing(4)]"
            />
            <StatCard
              label="Late"
              value={String(late)}
              icon={Clock}
              tone="warning"
              className="[--card-spacing:--spacing(2)] sm:[--card-spacing:--spacing(4)]"
            />
            <StatCard
              label="Total hours"
              value={totalHours.toFixed(1)}
              icon={Clock}
              className="[--card-spacing:--spacing(2)] sm:[--card-spacing:--spacing(4)]"
            />
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
              hidePagination
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
  const [filter, setFilter] = React.useState<"all" | "missing">("all");

  const { data, loading, error, refetch } = useAsync(() => getCompanyAttendance(dateStr), [dateStr]);

  const rows = data ?? [];
  const present = rows.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
  const late = rows.filter((r) => r.status === "LATE").length;
  const absent = rows.filter((r) => r.status === "ABSENT").length;
  const onLeave = rows.filter((r) => r.status === "ON_LEAVE").length;
  const missingCheckoutRows = rows.filter((r) => r.firstCheckInAt && !r.lastCheckOutAt);
  const visibleRows = filter === "missing" ? missingCheckoutRows : rows;

  const [correctionTarget, setCorrectionTarget] = React.useState<CompanyAttendanceRow | null>(null);
  const [correctionTime, setCorrectionTime] = React.useState("");
  const [correctionNote, setCorrectionNote] = React.useState("");
  const [sendingTestReminder, setSendingTestReminder] = React.useState(false);

  async function handleSendTestReminder() {
    setSendingTestReminder(true);
    try {
      const result = await sendMissingCheckoutReminderTest();
      toast.success(
        `Test reminder sent to you. ${result.missingCheckoutCount} employee(s) currently have a missing checkout.`,
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't send the test reminder.");
    } finally {
      setSendingTestReminder(false);
    }
  }

  function openCorrection(row: CompanyAttendanceRow) {
    setCorrectionTarget(row);
    // Pre-fill the date being reviewed - the admin only has to pick the time.
    setCorrectionTime(`${dateStr}T18:00`);
    setCorrectionNote("");
  }

  async function handleRecordCheckout() {
    if (!correctionTarget || !correctionTime) return;
    try {
      await recordAttendanceCorrection(correctionTarget.employeeId, {
        occurredAt: new Date(correctionTime).toISOString(),
        note: correctionNote.trim() || undefined,
      });
      toast.success(`Check-out recorded for ${correctionTarget.firstName} ${correctionTarget.lastName}`);
      setCorrectionTarget(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't record the check-out.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg border p-1">
          <Button size="sm" variant={filter === "all" ? "default" : "ghost"} onClick={() => setFilter("all")}>
            All
          </Button>
          <Button
            size="sm"
            variant={filter === "missing" ? "default" : "ghost"}
            onClick={() => setFilter("missing")}
          >
            Missing checkout
            {missingCheckoutRows.length > 0 && ` (${missingCheckoutRows.length})`}
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSendTestReminder}
            disabled={sendingTestReminder}
            className="w-full sm:w-auto"
          >
            {sendingTestReminder ? "Sending…" : "Send test reminder"}
          </Button>
          <DatePicker value={date} onChange={(d) => d && setDate(d)} />
        </div>
      </div>

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={refetch}
        loadingFallback={<StatGridSkeleton count={4} />}
      >
        {data && (
          <div className="grid grid-cols-4 gap-1.5 sm:gap-4">
            <StatCard
              label="Present"
              value={String(present)}
              icon={CheckCircle2}
              tone="success"
              className="[--card-spacing:--spacing(2)] sm:[--card-spacing:--spacing(4)]"
            />
            <StatCard
              label="Late"
              value={String(late)}
              icon={Clock}
              tone="warning"
              className="[--card-spacing:--spacing(2)] sm:[--card-spacing:--spacing(4)]"
            />
            <StatCard
              label="Absent"
              value={String(absent)}
              icon={UserX}
              className="[--card-spacing:--spacing(2)] sm:[--card-spacing:--spacing(4)]"
            />
            <StatCard
              label="On leave"
              value={String(onLeave)}
              className="[--card-spacing:--spacing(2)] sm:[--card-spacing:--spacing(4)]"
            />
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
            {visibleRows.length === 0 ? (
              <EmptyState
                icon={filter === "missing" ? CheckCircle2 : Clock}
                title={filter === "missing" ? "Nobody is missing a checkout" : "No active employees"}
              />
            ) : (
              <ul className="divide-y">
                {visibleRows.map((r) => {
                  const employee = employees.find((e) => e.id === r.employeeId);
                  const missingCheckout = !!r.firstCheckInAt && !r.lastCheckOutAt;
                  return (
                    <li key={r.employeeId} className="flex items-center gap-3 py-3">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                        onClick={() => employee && onSelectEmployee(employee)}
                        disabled={!employee}
                      >
                        <Avatar className="size-8 shrink-0">
                          {r.avatarUrl && <AvatarImage src={r.avatarUrl} alt="" />}
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
                      {missingCheckout && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Record check-out time"
                          className="shrink-0"
                          onClick={() => openCorrection(r)}
                        >
                          <AlarmClock className="size-3.5" />
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </AsyncSection>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!correctionTarget}
        onOpenChange={(open) => !open && setCorrectionTarget(null)}
        title="Record check-out time"
        description={
          correctionTarget
            ? `${correctionTarget.firstName} ${correctionTarget.lastName} checked in at ${correctionTarget.firstCheckInAt ? formatTime(correctionTarget.firstCheckInAt) : "—"} on ${formatDate(dateStr, { weekday: "short", day: "numeric", month: "short" })} with no check-out recorded. Enter the actual time they left.`
            : ""
        }
        confirmLabel="Save"
        confirmDisabled={!correctionTime}
        onConfirm={handleRecordCheckout}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="correction-time">Check-out time</Label>
            <Input
              id="correction-time"
              type="datetime-local"
              value={correctionTime}
              onChange={(e) => setCorrectionTime(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="correction-note">Note (optional)</Label>
            <Textarea
              id="correction-note"
              rows={2}
              placeholder="e.g. confirmed with employee"
              value={correctionNote}
              onChange={(e) => setCorrectionNote(e.target.value)}
            />
          </div>
        </div>
      </ConfirmDialog>
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
