import { apiFetch } from "@/lib/api-client";

export type DailyReportTemplate = "DEVELOPMENT" | "SEO" | "SOCIAL_MEDIA" | "SALES" | "HR" | "GENERAL";
export type DailyReportStatus = "SUBMITTED" | "LATE" | "EXCUSED" | "MISSING" | "NOT_REQUIRED" | "PENDING";
export type DailyReportTaskStatus = "IN_PROGRESS" | "COMPLETED" | "BLOCKED";
export type BlockerCategory =
  | "REQUIREMENT_UNCLEAR"
  | "TECHNICAL_COMPLEXITY"
  | "BUG"
  | "DEPENDENCY"
  | "WAITING_DESIGN"
  | "WAITING_APPROVAL"
  | "WAITING_CLIENT"
  | "ENVIRONMENT"
  | "REWORK"
  | "OTHER";

export interface DailyReportTaskEntry {
  id: string;
  title: string;
  project: { id: string; name: string } | null;
  status: DailyReportTaskStatus;
  expectedMinutes: number | null;
  actualMinutes: number | null;
  output: string | null;
  blockerCategory: BlockerCategory | null;
  blockerNote: string | null;
}

export interface DailyReport {
  date: string;
  status: DailyReportStatus;
  template: DailyReportTemplate;
  summary: string | null;
  blockers: string | null;
  tomorrowPlan: string | null;
  submittedAt: string | null;
  excuseReason: string | null;
  tasks: DailyReportTaskEntry[];
}

export interface DailyReportTaskEntryInput {
  title: string;
  projectId?: string;
  status: DailyReportTaskStatus;
  expectedMinutes?: number;
  actualMinutes?: number;
  output?: string;
  blockerCategory?: BlockerCategory;
  blockerNote?: string;
}

export interface UpsertDailyReportPayload {
  date?: string;
  summary?: string;
  blockers?: string;
  tomorrowPlan?: string;
  tasks: DailyReportTaskEntryInput[];
}

export function getMyDailyReport(date?: string): Promise<DailyReport> {
  return apiFetch<DailyReport>(`/daily-reports/me${date ? `?date=${date}` : ""}`);
}

export function upsertMyDailyReport(payload: UpsertDailyReportPayload): Promise<DailyReport> {
  return apiFetch<DailyReport>("/daily-reports/me", { method: "PUT", body: payload });
}

export interface TeamDailyReportRow {
  employee: { id: string; employeeCode: string; firstName: string; lastName: string };
  report: DailyReport;
}

export function getTeamDailyReports(date?: string): Promise<TeamDailyReportRow[]> {
  return apiFetch<TeamDailyReportRow[]>(`/daily-reports/team${date ? `?date=${date}` : ""}`);
}

export function getEmployeeDailyReport(employeeId: string, date?: string): Promise<DailyReport> {
  return apiFetch<DailyReport>(`/daily-reports/employees/${employeeId}${date ? `?date=${date}` : ""}`);
}

export function excuseMissingDailyReport(employeeId: string, date: string, reason: string): Promise<DailyReport> {
  return apiFetch<DailyReport>(`/daily-reports/employees/${employeeId}/excuse`, {
    method: "POST",
    body: { date, reason },
  });
}

const STATUS_LABELS: Record<DailyReportStatus, string> = {
  SUBMITTED: "Submitted",
  LATE: "Late",
  EXCUSED: "Excused",
  MISSING: "Missing",
  NOT_REQUIRED: "Not required",
  PENDING: "Pending",
};

export function formatDailyReportStatus(status: DailyReportStatus): string {
  return STATUS_LABELS[status];
}

const TEMPLATE_LABELS: Record<DailyReportTemplate, string> = {
  DEVELOPMENT: "Development",
  SEO: "SEO",
  SOCIAL_MEDIA: "Social Media",
  SALES: "Sales",
  HR: "HR",
  GENERAL: "General",
};

export function formatDailyReportTemplate(template: DailyReportTemplate): string {
  return TEMPLATE_LABELS[template];
}
