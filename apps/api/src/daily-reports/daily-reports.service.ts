import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext } from '../common/auth-context.js';
import { addDays, formatDateOnly, parseDateOnly, toDateOnly } from '../common/date-only.js';
import type { Prisma } from '../generated/prisma/client.js';
import type {
  DailyReportTemplate,
  DailyReportStatus,
  DailyReportTaskStatus,
  BlockerCategory,
} from '../generated/prisma/enums.js';
import type { SubmitDailyReportDto } from './dto/submit-daily-report.dto.js';
import type { SaveDailyReportDraftDto } from './dto/save-daily-report-draft.dto.js';
import type { ExcuseDailyReportDto } from './dto/excuse-daily-report.dto.js';
import type {
  GetDailyReportHistoryQueryDto,
  GetDailyReportQueryDto,
} from './dto/get-daily-report-query.dto.js';
import type {
  GetEmployeeTimeReportQueryDto,
  GetProjectTimeReportQueryDto,
} from './dto/get-time-report-query.dto.js';

const DEFAULT_HISTORY_DAYS = 45;
const MAX_HISTORY_DAYS = 92;
// Separate bounds from the per-employee history window above - a rollup
// naturally wants a wider default (a month of signal, not a fortnight)
// and a wider ceiling (a quarter, for a real trend), and the two aren't
// coupled by anything but coincidence.
const DEFAULT_BREAKDOWN_DAYS = 30;
const MAX_BREAKDOWN_DAYS = 180;

export interface BlockerBreakdown {
  from: string;
  to: string;
  totalTasks: number;
  blockedTasks: number;
  byCategory: { category: BlockerCategory; count: number }[];
}

export interface TimeReportTaskRow {
  date: string;
  title: string;
  minutes: number;
  output: string | null;
  status: DailyReportTaskStatus;
  /** Whichever dimension isn't the one that was picked - project name for by-employee, employee name for by-project. */
  otherDimension: string;
}

export interface TimeReportBucket {
  key: string;
  label: string;
  minutes: number;
  taskCount: number;
}

export interface TimeReport {
  from: string;
  to: string;
  totalMinutes: number;
  totalTasks: number;
  buckets: TimeReportBucket[];
  dailyTrend: { date: string; minutes: number }[];
  tasks: TimeReportTaskRow[];
}
// How far back an employee can still create/edit their own report - a
// fixed, simple window (not a configurable policy field, unlike the
// deadline/grace pair) covering "forgot yesterday, catching up this
// morning" plus same-day edits. Older gaps are HR/manager territory via
// excuse(), not silent self-editing.
const EDITABLE_WINDOW_DAYS = 1;

export interface ReportComputation {
  date: string;
  status: DailyReportStatus;
  template: DailyReportTemplate;
  summary: string | null;
  blockers: string | null;
  tomorrowPlan: string | null;
  submittedAt: Date | null;
  excuseReason: string | null;
  tasks: {
    id: string;
    title: string;
    project: { id: string; name: string } | null;
    status: string;
    startTime: string | null;
    endTime: string | null;
    output: string | null;
    blockerCategory: string | null;
    blockerNote: string | null;
  }[];
}

/**
 * P1 Daily Work Reporting. Deliberately does not touch Attendance at all —
 * see the module's own README-equivalent comment in daily-reports.module.ts.
 * A DailyReport row is only ever created by a real action (an employee
 * submits, or HR/a manager excuses a gap) — MISSING/NOT_REQUIRED/PENDING are
 * computed at read time for a date with no row, same shape as
 * AttendanceService's synthesize-on-read handling of WEEKEND/HOLIDAY/ABSENT.
 */
@Injectable()
export class DailyReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ---------------------------------------------------------------------
  // Self-service
  // ---------------------------------------------------------------------

  async getMyReport(userId: string, query: GetDailyReportQueryDto) {
    const employeeId = await this.requireEmployeeId(userId);
    const date = query.date ? parseDateOnly(query.date) : this.today();
    return this.computeReport(employeeId, date);
  }

  async getMyHistory(userId: string, query: GetDailyReportHistoryQueryDto) {
    const employeeId = await this.requireEmployeeId(userId);
    return this.computeHistory(employeeId, query);
  }

  /**
   * The final submission - strict validation (see SubmitDailyReportDto),
   * sets status (SUBMITTED/LATE) and submittedAt. See saveDraft for the
   * "still working on it" counterpart this is paired with.
   */
  async submitMyReport(userId: string, dto: SubmitDailyReportDto) {
    const employeeId = await this.requireEmployeeId(userId);
    const date = this.resolveEditableDate(dto.date);

    const today = this.today();
    const settings = await this.prisma.companySettings.findUniqueOrThrow({
      where: { id: 'singleton' },
    });
    const status = this.classifySubmission(settings, date, today);

    await this.prisma.$transaction(async (tx) => {
      const report = await tx.dailyReport.upsert({
        where: { employeeId_date: { employeeId, date } },
        create: {
          employeeId,
          date,
          status,
          summary: dto.summary,
          blockers: dto.blockers,
          tomorrowPlan: dto.tomorrowPlan,
          submittedAt: new Date(),
        },
        update: {
          status,
          summary: dto.summary ?? null,
          blockers: dto.blockers ?? null,
          tomorrowPlan: dto.tomorrowPlan ?? null,
          submittedAt: new Date(),
          // Resubmitting clears a prior excuse - the employee has now
          // actually filed the report, so "excused" no longer applies.
          excusedByUserId: null,
          excusedAt: null,
          excuseReason: null,
        },
      });

      await this.replaceTasks(tx, report.id, dto.tasks);
    });

    return this.computeReport(employeeId, date);
  }

  /**
   * Saves progress without submitting - lenient validation (see
   * SaveDailyReportDraftDto), and deliberately never touches
   * status/submittedAt/excuse fields on an existing row, so saving a draft
   * can never downgrade an already-submitted or -excused report. A fresh
   * row (nothing saved yet today) is created as PENDING with no
   * submittedAt. Called both by each task's own "Save" action and could be
   * called as a whole-form autosave - either way it's the same "persist
   * whatever's filled in so far" operation.
   */
  async saveDraft(userId: string, dto: SaveDailyReportDraftDto) {
    const employeeId = await this.requireEmployeeId(userId);
    const date = this.resolveEditableDate(dto.date);

    await this.prisma.$transaction(async (tx) => {
      const report = await tx.dailyReport.upsert({
        where: { employeeId_date: { employeeId, date } },
        create: {
          employeeId,
          date,
          status: 'PENDING',
          summary: dto.summary,
          blockers: dto.blockers,
          tomorrowPlan: dto.tomorrowPlan,
        },
        update: {
          summary: dto.summary ?? null,
          blockers: dto.blockers ?? null,
          tomorrowPlan: dto.tomorrowPlan ?? null,
        },
      });

      await this.replaceTasks(tx, report.id, dto.tasks ?? []);
    });

    return this.computeReport(employeeId, date);
  }

  /**
   * Simplest correct way to keep task entries in sync with a client-
   * submitted list (adds/removes/reorders all included) - report volume
   * here is one row per employee per day, capped at 30 tasks, so a
   * delete-then-recreate is cheap and avoids diffing logic that isn't
   * worth the complexity for this size of data. Shared by submit and
   * saveDraft - a draft task's optional fields just come through as
   * undefined/null, which the schema already allows.
   */
  private async replaceTasks(
    tx: Prisma.TransactionClient,
    dailyReportId: string,
    tasks: {
      title: string;
      projectId?: string;
      status?: DailyReportTaskStatus;
      startTime?: string;
      endTime?: string;
      output?: string;
      blockerCategory?: BlockerCategory;
      blockerNote?: string;
    }[],
  ): Promise<void> {
    await tx.dailyReportTaskEntry.deleteMany({ where: { dailyReportId } });
    if (tasks.length > 0) {
      await tx.dailyReportTaskEntry.createMany({
        data: tasks.map((task, index) => ({
          dailyReportId,
          title: task.title,
          projectId: task.projectId ?? null,
          status: task.status ?? 'IN_PROGRESS',
          startTime: task.startTime ?? null,
          endTime: task.endTime ?? null,
          output: task.output ?? null,
          blockerCategory: task.blockerCategory ?? null,
          blockerNote: task.blockerNote ?? null,
          sortOrder: index,
        })),
      });
    }
  }

  /** Shared future/self-edit-window check for both submit and saveDraft. */
  private resolveEditableDate(dateStr?: string): Date {
    const date = dateStr ? parseDateOnly(dateStr) : this.today();
    const today = this.today();
    const daysOld = Math.round((today.getTime() - date.getTime()) / 86_400_000);
    if (daysOld < 0) {
      throw new BadRequestException('Cannot save a report for a future date');
    }
    if (daysOld > EDITABLE_WINDOW_DAYS) {
      throw new BadRequestException(
        `This date is outside the ${EDITABLE_WINDOW_DAYS + 1}-day window employees can self-edit — ask HR to review it`,
      );
    }
    return date;
  }

  // ---------------------------------------------------------------------
  // Manager / HR / Admin - every method here is scope-checked. This is the
  // boundary decision #2 was explicit about: the *old* Performance
  // endpoints stay unscoped (documented technical debt, out of P1 scope),
  // but nothing new is allowed to copy that gap.
  // ---------------------------------------------------------------------

  async getTeamReports(actor: AuthContext, dateStr?: string) {
    const date = dateStr ? parseDateOnly(dateStr) : this.today();
    const scope = await this.resolveTeamScope(actor);

    const employees = await this.prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
        ...(scope === 'ALL' ? {} : { id: { in: scope } }),
      },
      select: { id: true, employeeCode: true, firstName: true, lastName: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    const reports = await Promise.all(
      employees.map(async (employee) => ({
        employee,
        report: await this.computeReport(employee.id, date),
      })),
    );
    return reports;
  }

  /**
   * Rolls up why work is blocked over a date range - the reporting need
   * the original brief actually asked for (distinguish dependency vs.
   * unclear requirements vs. waiting-for-approval, etc.), which task-level
   * blockerCategory has been capturing since P1 with nowhere to see the
   * pattern until now. Same team-scope rule as everything else here.
   */
  async getBlockerBreakdown(actor: AuthContext, query: GetDailyReportHistoryQueryDto): Promise<BlockerBreakdown> {
    const to = query.to ? parseDateOnly(query.to) : this.today();
    const from = query.from ? parseDateOnly(query.from) : addDays(to, -(DEFAULT_BREAKDOWN_DAYS - 1));
    if (from > to) throw new BadRequestException('"from" must not be after "to"');
    const spanDays = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
    if (spanDays > MAX_BREAKDOWN_DAYS) {
      throw new BadRequestException(`Requested range spans ${spanDays} days; the maximum is ${MAX_BREAKDOWN_DAYS}`);
    }

    const scope = await this.resolveTeamScope(actor);
    const employeeFilter = scope === 'ALL' ? {} : { employeeId: { in: scope } };
    const dailyReportFilter = { date: { gte: from, lte: to }, ...employeeFilter };

    const [totalTasks, blockedGroups] = await Promise.all([
      this.prisma.dailyReportTaskEntry.count({ where: { dailyReport: dailyReportFilter } }),
      this.prisma.dailyReportTaskEntry.groupBy({
        by: ['blockerCategory'],
        where: { blockerCategory: { not: null }, dailyReport: dailyReportFilter },
        _count: true,
      }),
    ]);

    const byCategory = blockedGroups
      .map((g) => ({ category: g.blockerCategory as BlockerCategory, count: g._count }))
      .sort((a, b) => b.count - a.count);
    const blockedTasks = byCategory.reduce((sum, g) => sum + g.count, 0);

    return { from: formatDateOnly(from), to: formatDateOnly(to), totalTasks, blockedTasks, byCategory };
  }

  /**
   * Time reported per project for one employee, over a date range - this is
   * self-reported *daily-report task time* (from a task's start/end),
   * distinct from Attendance's clock-derived workedMinutes and not expected
   * to reconcile with it. Includes tasks regardless of the parent
   * DailyReport's status (PENDING/SUBMITTED/LATE) - simplest and most
   * current, at the cost of same-day numbers shifting as a draft is edited.
   * hr/admin-only at the controller (RequirePermissions override on the
   * handler, not the class-level performance:manage manager also holds) -
   * no team-scope check needed here for that reason.
   */
  async getEmployeeTimeReport(query: GetEmployeeTimeReportQueryDto): Promise<TimeReport> {
    const from = parseDateOnly(query.from);
    const to = parseDateOnly(query.to);
    if (from > to) throw new BadRequestException('"from" must not be after "to"');
    const spanDays = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
    if (spanDays > MAX_BREAKDOWN_DAYS) {
      throw new BadRequestException(`Requested range spans ${spanDays} days; the maximum is ${MAX_BREAKDOWN_DAYS}`);
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: query.employeeId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const rows = await this.prisma.dailyReportTaskEntry.findMany({
      where: { dailyReport: { employeeId: query.employeeId, date: { gte: from, lte: to } } },
      include: { project: true, dailyReport: { select: { date: true } } },
    });

    return this.buildTimeReport(from, to, rows, (row) => ({
      key: row.projectId ?? 'none',
      label: row.project?.name ?? 'No project',
      otherDimension: row.project?.name ?? 'No project',
    }));
  }

  /**
   * Time reported per person for one project, over a date range - mirror of
   * getEmployeeTimeReport with the roles of project/employee swapped. Same
   * "self-reported task time, not attendance hours" and "includes drafts"
   * caveats apply.
   */
  async getProjectTimeReport(query: GetProjectTimeReportQueryDto): Promise<TimeReport> {
    const from = parseDateOnly(query.from);
    const to = parseDateOnly(query.to);
    if (from > to) throw new BadRequestException('"from" must not be after "to"');
    const spanDays = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
    if (spanDays > MAX_BREAKDOWN_DAYS) {
      throw new BadRequestException(`Requested range spans ${spanDays} days; the maximum is ${MAX_BREAKDOWN_DAYS}`);
    }

    const project = await this.prisma.project.findUnique({
      where: { id: query.projectId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const rows = await this.prisma.dailyReportTaskEntry.findMany({
      where: { projectId: query.projectId, dailyReport: { date: { gte: from, lte: to } } },
      include: {
        dailyReport: { select: { date: true, employee: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });

    return this.buildTimeReport(from, to, rows, (row) => {
      const employeeName = `${row.dailyReport.employee.firstName} ${row.dailyReport.employee.lastName}`.trim();
      return { key: row.dailyReport.employee.id, label: employeeName, otherDimension: employeeName };
    });
  }

  /**
   * Shared rollup: sums minutes in JS (the two source columns are "HH:mm"
   * VARCHARs - Prisma can't aggregate them), keyed by whatever bucketOf()
   * says (project for by-employee, employee for by-project). Same
   * negative-diff-means-crossed-midnight rule as the frontend's
   * minutesBetween (apps/web/src/lib/format.ts) - kept in sync deliberately
   * since the two apps can't share code.
   */
  private buildTimeReport<
    Row extends {
      title: string;
      startTime: string | null;
      endTime: string | null;
      output: string | null;
      status: DailyReportTaskStatus;
      dailyReport: { date: Date };
    },
  >(
    from: Date,
    to: Date,
    rows: Row[],
    bucketOf: (row: Row) => { key: string; label: string; otherDimension: string },
  ): TimeReport {
    const buckets = new Map<string, TimeReportBucket>();
    const dailyTotals = new Map<string, number>();
    const tasks: TimeReportTaskRow[] = [];
    let totalMinutes = 0;

    for (const row of rows) {
      const minutes = this.minutesBetween(row.startTime, row.endTime) ?? 0;
      const dateKey = formatDateOnly(row.dailyReport.date);
      const { key, label, otherDimension } = bucketOf(row);

      totalMinutes += minutes;
      dailyTotals.set(dateKey, (dailyTotals.get(dateKey) ?? 0) + minutes);

      const bucket = buckets.get(key) ?? { key, label, minutes: 0, taskCount: 0 };
      bucket.minutes += minutes;
      bucket.taskCount += 1;
      buckets.set(key, bucket);

      tasks.push({ date: dateKey, title: row.title, minutes, output: row.output, status: row.status, otherDimension });
    }

    const dailyTrend: { date: string; minutes: number }[] = [];
    for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
      const key = formatDateOnly(cursor);
      dailyTrend.push({ date: key, minutes: dailyTotals.get(key) ?? 0 });
    }

    return {
      from: formatDateOnly(from),
      to: formatDateOnly(to),
      totalMinutes,
      totalTasks: rows.length,
      buckets: [...buckets.values()].sort((a, b) => b.minutes - a.minutes),
      dailyTrend,
      tasks: tasks.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    };
  }

  /** Minutes between two "HH:mm" strings - null if either is missing, +24h if end < start (crossed midnight). Mirrors apps/web/src/lib/format.ts's minutesBetween. */
  private minutesBetween(startTime: string | null, endTime: string | null): number | null {
    if (!startTime || !endTime) return null;
    const start = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(startTime);
    const end = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(endTime);
    if (!start || !end) return null;
    const startMinutes = Number(start[1]) * 60 + Number(start[2]);
    const endMinutes = Number(end[1]) * 60 + Number(end[2]);
    const diff = endMinutes - startMinutes;
    return diff >= 0 ? diff : diff + 24 * 60;
  }

  async getEmployeeReport(actor: AuthContext, employeeId: string, query: GetDailyReportQueryDto) {
    await this.assertCanAccessEmployee(actor, employeeId);
    const date = query.date ? parseDateOnly(query.date) : this.today();
    return this.computeReport(employeeId, date);
  }

  async getEmployeeHistory(
    actor: AuthContext,
    employeeId: string,
    query: GetDailyReportHistoryQueryDto,
  ) {
    await this.assertCanAccessEmployee(actor, employeeId);
    return this.computeHistory(employeeId, query);
  }

  async excuse(actor: AuthContext, employeeId: string, dto: ExcuseDailyReportDto) {
    await this.assertCanAccessEmployee(actor, employeeId);

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const date = parseDateOnly(dto.date);
    const before = await this.computeReport(employeeId, date);
    if (before.status !== 'MISSING') {
      throw new BadRequestException(
        `Only a Missing report can be excused (this date is currently ${before.status})`,
      );
    }

    await this.prisma.dailyReport.upsert({
      where: { employeeId_date: { employeeId, date } },
      create: {
        employeeId,
        date,
        status: 'EXCUSED',
        excusedByUserId: actor.userId,
        excusedAt: new Date(),
        excuseReason: dto.reason,
      },
      update: {
        status: 'EXCUSED',
        excusedByUserId: actor.userId,
        excusedAt: new Date(),
        excuseReason: dto.reason,
      },
    });

    await this.auditService.log({
      eventType: 'DAILY_REPORT_EXCUSED',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Employee',
      targetId: employeeId,
      description: `Excused missing daily report for ${dto.date}: ${dto.reason} (was: ${before.status})`,
    });

    return this.computeReport(employeeId, date);
  }

  // ---------------------------------------------------------------------
  // Scope resolution
  // ---------------------------------------------------------------------

  /** 'ALL' for hr/admin (matches how performance:manage is already granted to them org-wide); a manager gets exactly their direct reports, resolved from Employee.managerId - the one real manager/employee relationship this app has. */
  private async resolveTeamScope(actor: AuthContext): Promise<'ALL' | string[]> {
    if (actor.roles.includes('hr') || actor.roles.includes('admin')) return 'ALL';

    const managerEmployeeId = await this.requireEmployeeId(actor.userId);
    const reports = await this.prisma.employee.findMany({
      where: { managerId: managerEmployeeId },
      select: { id: true },
    });
    return reports.map((r) => r.id);
  }

  private async assertCanAccessEmployee(actor: AuthContext, employeeId: string): Promise<void> {
    const scope = await this.resolveTeamScope(actor);
    if (scope === 'ALL') return;
    if (!scope.includes(employeeId)) {
      throw new ForbiddenException(
        "You can only view or manage your own direct reports' daily reports",
      );
    }
  }

  // ---------------------------------------------------------------------
  // Core read logic - synthesize on read, see the class comment.
  // ---------------------------------------------------------------------

  private async computeHistory(employeeId: string, query: GetDailyReportHistoryQueryDto) {
    const today = this.today();
    const to = query.to ? parseDateOnly(query.to) : today;
    const from = query.from ? parseDateOnly(query.from) : addDays(to, -(DEFAULT_HISTORY_DAYS - 1));
    if (from > to) throw new BadRequestException('"from" must not be after "to"');
    const spanDays = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
    if (spanDays > MAX_HISTORY_DAYS) {
      throw new BadRequestException(`Requested range spans ${spanDays} days; the maximum is ${MAX_HISTORY_DAYS}`);
    }

    const result: ReportComputation[] = [];
    for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
      result.push(await this.computeReport(employeeId, cursor));
    }
    return result;
  }

  private async computeReport(employeeId: string, date: Date): Promise<ReportComputation> {
    const [employee, row, settings] = await Promise.all([
      this.prisma.employee.findUniqueOrThrow({
        where: { id: employeeId },
        select: {
          dailyReportExempt: true,
          dailyReportTemplateOverride: true,
          designation: { select: { dailyReportTemplate: true } },
        },
      }),
      this.prisma.dailyReport.findUnique({
        where: { employeeId_date: { employeeId, date } },
        include: { tasks: { include: { project: true }, orderBy: { sortOrder: 'asc' } } },
      }),
      this.prisma.companySettings.findUniqueOrThrow({ where: { id: 'singleton' } }),
    ]);

    const template: DailyReportTemplate =
      employee.dailyReportTemplateOverride ?? employee.designation?.dailyReportTemplate ?? 'GENERAL';

    if (row) {
      return {
        date: formatDateOnly(date),
        status: row.status,
        template,
        summary: row.summary,
        blockers: row.blockers,
        tomorrowPlan: row.tomorrowPlan,
        submittedAt: row.submittedAt,
        excuseReason: row.excuseReason,
        tasks: row.tasks,
      };
    }

    const required = await this.isReportingRequired(employeeId, date, employee.dailyReportExempt, settings);
    const status: DailyReportStatus = required
      ? this.hasGracePeriodPassed(settings, date, this.today())
        ? 'MISSING'
        : 'PENDING'
      : 'NOT_REQUIRED';

    return {
      date: formatDateOnly(date),
      status,
      template,
      summary: null,
      blockers: null,
      tomorrowPlan: null,
      submittedAt: null,
      excuseReason: null,
      tasks: [],
    };
  }

  /** Required = policy is on, employee isn't exempt, it's a working day, no active holiday, and no approved leave covers this date - the same exception sources Attendance itself already uses. */
  private async isReportingRequired(
    employeeId: string,
    date: Date,
    isExempt: boolean,
    settings: { dailyReportRequired: boolean },
  ): Promise<boolean> {
    if (!settings.dailyReportRequired || isExempt) return false;

    const [policy, holiday, approvedLeave] = await Promise.all([
      this.prisma.attendancePolicy.findUnique({ where: { id: 'singleton' } }),
      this.prisma.holiday.findFirst({ where: { date, isActive: true } }),
      this.prisma.leaveRequest.findFirst({
        where: { employeeId, status: 'APPROVED', startDate: { lte: date }, endDate: { gte: date } },
      }),
    ]);
    if (!policy || holiday || approvedLeave) return false;

    const workingWeekdays = new Set(policy.workingWeekdays as number[]);
    const isoWeekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
    return workingWeekdays.has(isoWeekday);
  }

  /** Status a fresh submission gets right now: SUBMITTED before deadline+grace, LATE after — always SUBMITTED while the policy is off, since there's no deadline to be late against. Same UTC-getter-for-a-TIME-column convention as AttendanceService.computeLateMinutes. */
  private classifySubmission(
    settings: { dailyReportRequired: boolean; dailyReportDeadline: Date | null; dailyReportGraceMinutes: number | null },
    date: Date,
    today: Date,
  ): DailyReportStatus {
    if (!settings.dailyReportRequired || !settings.dailyReportDeadline || date.getTime() !== today.getTime()) {
      return 'SUBMITTED';
    }
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const deadline = settings.dailyReportDeadline;
    const deadlineMinutes = deadline.getUTCHours() * 60 + deadline.getUTCMinutes();
    const graceEnd = deadlineMinutes + (settings.dailyReportGraceMinutes ?? 0);
    return nowMinutes <= graceEnd ? 'SUBMITTED' : 'LATE';
  }

  private hasGracePeriodPassed(
    settings: { dailyReportDeadline: Date | null; dailyReportGraceMinutes: number | null },
    date: Date,
    today: Date,
  ): boolean {
    if (date.getTime() < today.getTime()) return true; // any past required day is fully past its window
    if (date.getTime() > today.getTime()) return false; // future date - nothing to be missing yet
    if (!settings.dailyReportDeadline) return false; // required but no deadline configured - never "missing"
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const deadline = settings.dailyReportDeadline;
    const deadlineMinutes = deadline.getUTCHours() * 60 + deadline.getUTCMinutes();
    const graceEnd = deadlineMinutes + (settings.dailyReportGraceMinutes ?? 0);
    return nowMinutes > graceEnd;
  }

  private today(): Date {
    return toDateOnly(new Date());
  }

  private async requireEmployeeId(userId: string): Promise<string> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException('No employee profile is linked to this account');
    }
    return employee.id;
  }
}
