"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle, ClipboardList } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { ApiError } from "@/lib/api-client";
import {
  getTeamDailyReports,
  excuseMissingDailyReport,
  getBlockerBreakdown,
  formatDailyReportStatus,
  formatDailyReportTemplate,
  formatBlockerCategory,
  type TeamDailyReportRow,
} from "@/lib/api/daily-reports";
import { employeeFullName } from "@/lib/api/employees";
import { formatDate, formatTime, toDateOnlyString } from "@/lib/format";
import { PageHeader } from "@/components/hrm/page-header";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { StatusBadge } from "@/components/hrm/status-badge";
import { TableSkeleton } from "@/components/hrm/loading-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker, DateRangePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const BLOCKER_BREAKDOWN_DEFAULT_DAYS = 30;

function defaultBlockerRange(): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - (BLOCKER_BREAKDOWN_DEFAULT_DAYS - 1));
  return { from, to };
}

function BlockerBreakdownView() {
  const [range, setRange] = React.useState(defaultBlockerRange);
  const fromStr = range.from ? toDateOnlyString(range.from) : undefined;
  const toStr = range.to ? toDateOnlyString(range.to) : undefined;

  const { data, loading, error, refetch } = useAsync(
    () => getBlockerBreakdown(fromStr, toStr),
    [fromStr, toStr],
  );

  const maxCount = Math.max(1, ...(data?.byCategory.map((c) => c.count) ?? []));
  const blockedPct = data && data.totalTasks > 0 ? Math.round((data.blockedTasks / data.totalTasks) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DateRangePicker
          value={range}
          onChange={(next) => next?.from && next?.to && setRange({ from: next.from, to: next.to })}
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <AsyncSection loading={loading} error={error} onRetry={refetch} loadingFallback={<TableSkeleton rows={6} columns={2} />}>
            {!data || data.byCategory.length === 0 ? (
              <EmptyState icon={AlertTriangle} title="No blocked tasks in this range" />
            ) : (
              <div className="space-y-5">
                <p className="text-muted-foreground text-sm">
                  <span className="text-foreground font-medium">{data.blockedTasks}</span> of{" "}
                  <span className="text-foreground font-medium">{data.totalTasks}</span> logged tasks were blocked (
                  {blockedPct}%), {formatDate(data.from)} – {formatDate(data.to)}.
                </p>
                <div className="space-y-3">
                  {data.byCategory.map((c) => (
                    <div key={c.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{formatBlockerCategory(c.category)}</span>
                        <span className="font-medium tabular-nums">{c.count}</span>
                      </div>
                      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${(c.count / maxCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </AsyncSection>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportDetailDialog({ row, onClose }: { row: TeamDailyReportRow; onClose: () => void }) {
  const { employee, report } = row;
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{employeeFullName(employee)}</DialogTitle>
          <DialogDescription>
            {formatDate(report.date)} · {formatDailyReportTemplate(report.template)} template
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <StatusBadge status={formatDailyReportStatus(report.status)} />
          {report.summary && (
            <div>
              <p className="text-muted-foreground text-xs">Summary</p>
              <p className="text-sm">{report.summary}</p>
            </div>
          )}
          {report.tasks.length > 0 && (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs">Tasks</p>
              <ul className="space-y-2">
                {report.tasks.map((t) => (
                  <li key={t.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{t.title}</span>
                      <StatusBadge status={t.status.replace("_", " ")} />
                    </div>
                    {t.project && <p className="text-muted-foreground text-xs">{t.project.name}</p>}
                    {(t.expectedMinutes != null || t.actualMinutes != null) && (
                      <p className="text-muted-foreground text-xs">
                        Expected {t.expectedMinutes ?? "—"}m · Actual {t.actualMinutes ?? "—"}m
                      </p>
                    )}
                    {t.output && <p className="mt-1">{t.output}</p>}
                    {t.blockerNote && (
                      <p className="text-destructive mt-1 text-xs">
                        Blocked ({t.blockerCategory ? formatBlockerCategory(t.blockerCategory) : "Other"}): {t.blockerNote}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.blockers && (
            <div>
              <p className="text-muted-foreground text-xs">Overall blockers</p>
              <p className="text-sm">{report.blockers}</p>
            </div>
          )}
          {report.tomorrowPlan && (
            <div>
              <p className="text-muted-foreground text-xs">Tomorrow&apos;s plan</p>
              <p className="text-sm">{report.tomorrowPlan}</p>
            </div>
          )}
          {report.excuseReason && (
            <div>
              <p className="text-muted-foreground text-xs">Excuse reason</p>
              <p className="text-sm">{report.excuseReason}</p>
            </div>
          )}
          {report.status === "NOT_REQUIRED" && (
            <p className="text-muted-foreground text-sm">No report was required this day.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExcuseDialog({
  row,
  onClose,
  onSaved,
}: {
  row: TeamDailyReportRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await excuseMissingDailyReport(row.employee.id, row.report.date, reason.trim());
      toast.success(`Excused ${employeeFullName(row.employee)}'s missing report`);
      onClose();
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this override. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excuse missing report</DialogTitle>
          <DialogDescription>
            {employeeFullName(row.employee)} · {formatDate(row.report.date)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="excuse-reason">Reason *</Label>
            <Textarea
              id="excuse-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Confirmed present via manager, form was overlooked"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !reason.trim()}>
            {saving ? "Saving…" : "Excuse"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TeamDailyReportsPage() {
  const [date, setDate] = React.useState<Date>(new Date());
  const dateStr = toDateOnlyString(date);
  const { data, loading, error, refetch } = useAsync(() => getTeamDailyReports(dateStr), [dateStr]);
  const [viewing, setViewing] = React.useState<TeamDailyReportRow | null>(null);
  const [excusing, setExcusing] = React.useState<TeamDailyReportRow | null>(null);

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Daily Reports" description="Your team's daily work report status." />

      <Tabs defaultValue="roster">
        <TabsList>
          <TabsTrigger value="roster">Roster</TabsTrigger>
          <TabsTrigger value="blockers">Blocker breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="roster" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <DatePicker value={date} onChange={(d) => d && setDate(d)} />
          </div>

          <Card>
            <CardContent className="pt-6">
              <AsyncSection
                loading={loading}
                error={error}
                onRetry={refetch}
                loadingFallback={<TableSkeleton rows={8} columns={4} />}
              >
                {rows.length === 0 ? (
                  <EmptyState icon={ClipboardList} title="No active employees in your scope" />
                ) : (
                  <ul className="divide-y">
                    {rows.map((row) => (
                      <li key={row.employee.id} className="flex items-center justify-between gap-3 py-3">
                        <div>
                          <p className="text-sm font-medium">{employeeFullName(row.employee)}</p>
                          <p className="text-muted-foreground text-xs">
                            {row.employee.employeeCode}
                            {row.report.status !== "NOT_REQUIRED" && ` · ${row.report.tasks.length} task${row.report.tasks.length === 1 ? "" : "s"}`}
                            {row.report.submittedAt && ` · ${formatTime(row.report.submittedAt)}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <StatusBadge status={formatDailyReportStatus(row.report.status)} />
                          <Button variant="outline" size="sm" onClick={() => setViewing(row)}>
                            View
                          </Button>
                          {row.report.status === "MISSING" && (
                            <Button variant="outline" size="sm" onClick={() => setExcusing(row)}>
                              Excuse
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </AsyncSection>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blockers" className="mt-4">
          <BlockerBreakdownView />
        </TabsContent>
      </Tabs>

      {viewing && <ReportDetailDialog row={viewing} onClose={() => setViewing(null)} />}
      {excusing && (
        <ExcuseDialog
          row={excusing}
          onClose={() => setExcusing(null)}
          onSaved={refetch}
        />
      )}
    </div>
  );
}
