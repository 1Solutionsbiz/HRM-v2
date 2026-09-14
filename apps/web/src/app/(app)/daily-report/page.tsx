"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { ApiError } from "@/lib/api-client";
import {
  getMyDailyReport,
  saveDailyReportDraft,
  submitMyDailyReport,
  formatDailyReportStatus,
  BLOCKER_CATEGORY_OPTIONS,
  type DailyReport,
  type DailyReportTaskStatus,
  type BlockerCategory,
} from "@/lib/api/daily-reports";
import { getProjects, type Project } from "@/lib/api/projects";
import { formatDate, formatTime, formatMinutes, minutesBetween, toDateOnlyString } from "@/lib/format";
import { PageHeader } from "@/components/hrm/page-header";
import { AsyncSection } from "@/components/hrm/async-section";
import { StatusBadge } from "@/components/hrm/status-badge";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TASK_STATUS_OPTIONS: { value: DailyReportTaskStatus; label: string }[] = [
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "BLOCKED", label: "Blocked" },
];


interface TaskDraft {
  key: string;
  title: string;
  projectId: string;
  status: DailyReportTaskStatus;
  startTime: string;
  endTime: string;
  output: string;
  blockerCategory: BlockerCategory | "";
  blockerNote: string;
}

function emptyTask(): TaskDraft {
  return {
    key: crypto.randomUUID(),
    title: "",
    projectId: "",
    status: "IN_PROGRESS",
    startTime: "",
    endTime: "",
    output: "",
    blockerCategory: "",
    blockerNote: "",
  };
}

function toTaskDrafts(report: DailyReport): TaskDraft[] {
  return report.tasks.length > 0
    ? report.tasks.map((t) => ({
        key: t.id,
        title: t.title,
        projectId: t.project?.id ?? "",
        status: t.status,
        startTime: t.startTime ?? "",
        endTime: t.endTime ?? "",
        output: t.output ?? "",
        blockerCategory: t.blockerCategory ?? "",
        blockerNote: t.blockerNote ?? "",
      }))
    : [emptyTask()];
}

export default function DailyReportPage() {
  const today = React.useMemo(() => new Date(), []);
  const yesterday = React.useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return d;
  }, [today]);
  const [selectedDate, setSelectedDate] = React.useState(toDateOnlyString(today));

  const { data: report, loading, error, refetch } = useAsync(
    () => getMyDailyReport(selectedDate),
    [selectedDate],
  );
  const { data: projects } = useAsync(getProjects);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Work Report"
        description="What you worked on, what's done, and what's blocked - takes about 5 minutes."
      />

      <Tabs value={selectedDate} onValueChange={setSelectedDate}>
        <TabsList>
          <TabsTrigger value={toDateOnlyString(today)}>Today</TabsTrigger>
          <TabsTrigger value={toDateOnlyString(yesterday)}>Yesterday</TabsTrigger>
        </TabsList>
      </Tabs>

      <AsyncSection loading={loading} error={error} onRetry={refetch} loadingFallback={<CardSkeleton lines={6} />}>
        {/* Keyed by date: a fresh mount per date switch gives each DailyReportForm
            its own lazily-initialized draft state with no effect needed to
            re-sync it - same "mounts fresh, no sync effect" pattern used across
            this app's dialogs (e.g. EditProfileDialog). */}
        {report && (
          <DailyReportForm key={report.date} report={report} projects={projects ?? []} onSaved={refetch} />
        )}
      </AsyncSection>
    </div>
  );
}

function DailyReportForm({
  report,
  projects,
  onSaved,
}: {
  report: DailyReport;
  projects: Project[];
  onSaved: () => void;
}) {
  const [summary, setSummary] = React.useState(report.summary ?? "");
  const [blockers, setBlockers] = React.useState(report.blockers ?? "");
  const [tomorrowPlan, setTomorrowPlan] = React.useState(report.tomorrowPlan ?? "");
  const [tasks, setTasks] = React.useState<TaskDraft[]>(() => toTaskDrafts(report));
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  function updateTask(key: string, patch: Partial<TaskDraft>) {
    setTasks((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addTask() {
    setTasks((rows) => [...rows, emptyTask()]);
  }

  function removeTask(key: string) {
    setTasks((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));
  }

  /**
   * Saves everything filled in so far as a draft - no field requirements
   * beyond the task being saved needing a title, so this can be used
   * mid-way through filling the form out and revisited later. Sends the
   * whole current form state (every task with a title, not just the one
   * whose Save button was clicked), since the backend replaces the task
   * list wholesale - see DailyReportsService.saveDraft.
   */
  async function handleSaveTaskDraft(taskKey: string) {
    const target = tasks.find((t) => t.key === taskKey);
    if (!target?.title.trim()) {
      toast.error("Enter a title for this task before saving.");
      return;
    }
    const draftTasks = tasks.filter((t) => t.title.trim());

    setSavingKey(taskKey);
    try {
      await saveDailyReportDraft({
        date: report.date,
        summary: summary.trim() || undefined,
        blockers: blockers.trim() || undefined,
        tomorrowPlan: tomorrowPlan.trim() || undefined,
        tasks: draftTasks.map((t) => ({
          title: t.title.trim(),
          projectId: t.projectId || undefined,
          status: t.status,
          startTime: t.startTime || undefined,
          endTime: t.endTime || undefined,
          output: t.output.trim() || undefined,
          blockerCategory: t.blockerCategory || undefined,
          blockerNote: t.blockerNote.trim() || undefined,
        })),
      });
      toast.success("Task saved");
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't save this task. Please try again.");
    } finally {
      setSavingKey(null);
    }
  }

  async function handleSubmit() {
    const validTasks = tasks
      .map((t, index) => ({ t, index }))
      .filter(({ t }) => t.title.trim());
    if (validTasks.length === 0) {
      toast.error("Add at least one task with a title.");
      return;
    }
    for (const { t, index } of validTasks) {
      const label = `Task ${index + 1}`;
      if (!t.projectId) return toast.error(`${label}: select a project.`);
      if (!t.startTime) return toast.error(`${label}: enter a start time.`);
      if (!t.endTime) return toast.error(`${label}: enter an end time.`);
      if (!t.output.trim()) return toast.error(`${label}: enter the output / deliverable.`);
      if (t.status === "BLOCKED") {
        if (!t.blockerCategory) return toast.error(`${label}: select a blocker reason.`);
        if (!t.blockerNote.trim()) return toast.error(`${label}: enter blocker details.`);
      }
    }
    if (!summary.trim()) return toast.error("Add an overall summary.");
    if (!tomorrowPlan.trim()) return toast.error("Add tomorrow's plan.");

    setSubmitting(true);
    try {
      await submitMyDailyReport({
        date: report.date,
        summary: summary.trim(),
        blockers: blockers.trim() || undefined,
        tomorrowPlan: tomorrowPlan.trim(),
        tasks: validTasks.map(({ t }) => ({
          title: t.title.trim(),
          projectId: t.projectId,
          status: t.status,
          startTime: t.startTime,
          endTime: t.endTime,
          output: t.output.trim(),
          blockerCategory: t.blockerCategory || undefined,
          blockerNote: t.blockerNote.trim() || undefined,
        })),
      });
      toast.success("Daily report submitted");
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't submit your report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const canEdit = report.status !== "NOT_REQUIRED";

  return (
    <>
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div>
            <p className="text-sm font-medium">{formatDate(report.date)}</p>
            {report.submittedAt && (
              <p className="text-muted-foreground text-xs">Submitted {formatTime(report.submittedAt)}</p>
            )}
          </div>
          <StatusBadge status={formatDailyReportStatus(report.status)} />
        </CardContent>
      </Card>

      {!canEdit ? (
        <Card>
          <CardContent className="text-muted-foreground pt-6 text-sm">
            No report is required for this day (weekend, holiday, approved leave, or reporting is not currently
            required).
          </CardContent>
        </Card>
      ) : (
        <>
          {report.status === "EXCUSED" && report.excuseReason && (
            <Card>
              <CardContent className="pt-6 text-sm">
                <span className="font-medium">Excused: </span>
                {report.excuseReason}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Tasks</p>
                <Button variant="outline" size="sm" onClick={addTask}>
                  <Plus />
                  Add task
                </Button>
              </div>

              {tasks.map((task, index) => (
                <div key={task.key} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-muted-foreground text-xs font-medium">Task {index + 1}</p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSaveTaskDraft(task.key)}
                        disabled={savingKey !== null}
                      >
                        {savingKey === task.key ? "Saving…" : "Save"}
                      </Button>
                      {tasks.length > 1 && (
                        <Button variant="ghost" size="icon-sm" aria-label="Remove task" onClick={() => removeTask(task.key)}>
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Task *</Label>
                      <Input
                        value={task.title}
                        onChange={(e) => updateTask(task.key, { title: e.target.value })}
                        placeholder="What did you work on?"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Project *</Label>
                      <Select
                        value={task.projectId}
                        onValueChange={(v) => updateTask(task.key, { projectId: v })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                        <SelectContent>
                          {/* Archived projects only show up if this task already points at one - kept so its name still renders, but not offered for a fresh pick. */}
                          {projects
                            .filter((p) => p.isActive || p.id === task.projectId)
                            .map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                                {!p.isActive ? " (archived)" : ""}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <Select
                        value={task.status}
                        onValueChange={(v) => updateTask(task.key, { status: v as DailyReportTaskStatus })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TASK_STATUS_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label>Start time *</Label>
                        <Input
                          type="time"
                          value={task.startTime}
                          onChange={(e) => updateTask(task.key, { startTime: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>End time *</Label>
                        <Input
                          type="time"
                          value={task.endTime}
                          onChange={(e) => updateTask(task.key, { endTime: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Total time</Label>
                        <p className="text-muted-foreground flex h-8 items-center text-sm">
                          {(() => {
                            const total = minutesBetween(task.startTime, task.endTime);
                            return total != null ? formatMinutes(total) : "—";
                          })()}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Output / deliverable *</Label>
                      <Textarea
                        rows={2}
                        value={task.output}
                        onChange={(e) => updateTask(task.key, { output: e.target.value })}
                      />
                    </div>
                    {task.status === "BLOCKED" && (
                      <>
                        <div className="space-y-1.5">
                          <Label>Blocker reason *</Label>
                          <Select
                            value={task.blockerCategory}
                            onValueChange={(v) => updateTask(task.key, { blockerCategory: v as BlockerCategory })}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {BLOCKER_CATEGORY_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Blocker details *</Label>
                          <Input
                            value={task.blockerNote}
                            onChange={(e) => updateTask(task.key, { blockerNote: e.target.value })}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-1.5">
                <Label>Overall summary *</Label>
                <Textarea rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Blockers (overall)</Label>
                <Textarea rows={2} value={blockers} onChange={(e) => setBlockers(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Tomorrow&apos;s plan *</Label>
                <Textarea rows={2} value={tomorrowPlan} onChange={(e) => setTomorrowPlan(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Report"}
            </Button>
          </div>
        </>
      )}
    </>
  );
}
