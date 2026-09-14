"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { BarChart3, Calendar as CalendarIcon, Clock, ListTodo, PieChart, X } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import {
  getEmployeeTimeReport,
  getProjectTimeReport,
  type TimeReport,
  type TimeReportTaskRow,
} from "@/lib/api/daily-reports";
import { getEmployees, employeeFullName, titleCase, type EmployeeListItem } from "@/lib/api/employees";
import { getProjects, type Project } from "@/lib/api/projects";
import { formatDate, formatMinutes } from "@/lib/format";
import { rangeForPeriod, PERIODS, type Period } from "@/lib/period";
import { PageHeader } from "@/components/hrm/page-header";
import { StatCard } from "@/components/hrm/stat-card";
import { StatusBadge } from "@/components/hrm/status-badge";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { EmployeePicker } from "@/components/hrm/employee-picker";
import { StatGridSkeleton, TableSkeleton } from "@/components/hrm/loading-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { DatePicker } from "@/components/ui/date-picker";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TimeBreakdownChart, TimeBreakdownPieChart, TimeTrendChart } from "./time-report-charts";

type Mode = "employee" | "project";

export default function TimeReportsPage() {
  const [mode, setMode] = React.useState<Mode>("employee");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Time Reports"
        description="Reported task time by employee or project, day/week/month/quarter."
      />

      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList>
          <TabsTrigger value="employee">By employee</TabsTrigger>
          <TabsTrigger value="project">By project</TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "employee" ? <ByEmployeeReport /> : <ByProjectReport />}
    </div>
  );
}

function PeriodControls({
  period,
  setPeriod,
  refDate,
  setRefDate,
}: {
  period: Period;
  setPeriod: (p: Period) => void;
  refDate: Date;
  setRefDate: (d: Date) => void;
}) {
  return (
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
  );
}

function taskColumns(otherDimensionLabel: string, totalMinutes: number): ColumnDef<TimeReportTaskRow>[] {
  return [
    { accessorKey: "date", header: "Date", cell: ({ row }) => formatDate(row.original.date) },
    { accessorKey: "otherDimension", header: otherDimensionLabel },
    { accessorKey: "title", header: "Task" },
    {
      accessorKey: "minutes",
      header: "Time",
      cell: ({ row }) => formatMinutes(row.original.minutes),
    },
    {
      id: "share",
      header: "% of total",
      cell: ({ row }) =>
        totalMinutes > 0 ? `${((row.original.minutes / totalMinutes) * 100).toFixed(1)}%` : "—",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={titleCase(row.original.status)} />,
    },
    {
      accessorKey: "output",
      header: "Output",
      cell: ({ row }) => row.original.output || "—",
    },
  ];
}

function ReportResult({ report, otherDimensionLabel }: { report: TimeReport; otherDimensionLabel: string }) {
  const [chartType, setChartType] = React.useState<"bar" | "pie">("bar");

  if (report.totalTasks === 0) {
    return <EmptyState icon={ListTodo} title="No reported tasks in this range" />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Reported time" value={formatMinutes(report.totalMinutes)} icon={Clock} tone="primary" />
        <StatCard label="Tasks reported" value={String(report.totalTasks)} icon={ListTodo} tone="success" />
      </div>
      <p className="text-muted-foreground text-xs">
        Reported task time, from each task&apos;s start/end - not attendance clock hours, and may not match it.
        Includes reports still in progress (not yet submitted) for today, so today&apos;s numbers can shift.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{otherDimensionLabel} breakdown</p>
              <div className="flex gap-1 rounded-lg border p-1">
                <Button
                  size="icon-sm"
                  variant={chartType === "bar" ? "default" : "ghost"}
                  aria-label="Bar chart"
                  onClick={() => setChartType("bar")}
                >
                  <BarChart3 className="size-4" />
                </Button>
                <Button
                  size="icon-sm"
                  variant={chartType === "pie" ? "default" : "ghost"}
                  aria-label="Pie chart"
                  onClick={() => setChartType("pie")}
                >
                  <PieChart className="size-4" />
                </Button>
              </div>
            </div>
            {chartType === "bar" ? (
              <TimeBreakdownChart data={report.buckets} />
            ) : (
              <TimeBreakdownPieChart data={report.buckets} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="mb-3 text-sm font-semibold">Daily trend</p>
            <TimeTrendChart data={report.dailyTrend} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="mb-3 text-sm font-semibold">Tasks</p>
          <DataTable
            columns={taskColumns(otherDimensionLabel, report.totalMinutes)}
            data={report.tasks}
            emptyTitle="No tasks in this range"
            hidePagination
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ByEmployeeReport() {
  const [employee, setEmployee] = React.useState<EmployeeListItem | null>(null);
  const [period, setPeriod] = React.useState<Period>("month");
  const [refDate, setRefDate] = React.useState(new Date());
  const { data: employees } = useAsync(getEmployees);
  // Deactivated logins (e.g. Raman/Deepu) still have Employee.status
  // ACTIVE, so the status filter alone isn't enough here - this picker
  // shouldn't offer someone nobody can currently report on.
  const activeEmployees = React.useMemo(
    () => (employees ?? []).filter((e) => e.status === "ACTIVE" && e.user.isActive),
    [employees],
  );

  const { from, to } = React.useMemo(() => rangeForPeriod(period, refDate), [period, refDate]);
  const { data, loading, error, refetch } = useAsync(
    () => (employee ? getEmployeeTimeReport(employee.id, from, to) : Promise.resolve(null)),
    [employee?.id, from, to],
  );

  if (!employee) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="mb-3 text-sm font-medium">Pick an employee</p>
          <EmployeePicker employees={activeEmployees} onSelect={setEmployee} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <p className="text-sm font-semibold">{employeeFullName(employee)}</p>
          <Button variant="ghost" size="sm" onClick={() => setEmployee(null)}>
            <X />
            Change employee
          </Button>
        </CardContent>
      </Card>

      <PeriodControls period={period} setPeriod={setPeriod} refDate={refDate} setRefDate={setRefDate} />

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={refetch}
        loadingFallback={
          <div className="space-y-4">
            <StatGridSkeleton count={2} />
            <TableSkeleton rows={6} columns={6} />
          </div>
        }
      >
        {data && <ReportResult report={data} otherDimensionLabel="Project" />}
      </AsyncSection>
    </div>
  );
}

function ByProjectReport() {
  const [project, setProject] = React.useState<Project | null>(null);
  const [period, setPeriod] = React.useState<Period>("month");
  const [refDate, setRefDate] = React.useState(new Date());
  const { data: projects } = useAsync(getProjects);

  const { from, to } = React.useMemo(() => rangeForPeriod(period, refDate), [period, refDate]);
  const { data, loading, error, refetch } = useAsync(
    () => (project ? getProjectTimeReport(project.id, from, to) : Promise.resolve(null)),
    [project?.id, from, to],
  );

  if (!project) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="mb-3 text-sm font-medium">Pick a project</p>
          <Select
            value=""
            onValueChange={(id) => {
              const p = (projects ?? []).find((x) => x.id === id);
              if (p) setProject(p);
            }}
          >
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {(projects ?? [])
                .filter((p) => p.isActive)
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <p className="text-sm font-semibold">{project.name}</p>
          <Button variant="ghost" size="sm" onClick={() => setProject(null)}>
            <X />
            Change project
          </Button>
        </CardContent>
      </Card>

      <PeriodControls period={period} setPeriod={setPeriod} refDate={refDate} setRefDate={setRefDate} />

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={refetch}
        loadingFallback={
          <div className="space-y-4">
            <StatGridSkeleton count={2} />
            <TableSkeleton rows={6} columns={6} />
          </div>
        }
      >
        {data && <ReportResult report={data} otherDimensionLabel="Person" />}
      </AsyncSection>
    </div>
  );
}
