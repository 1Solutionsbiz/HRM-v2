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
import type {
  DailyReportTemplate,
  DailyReportStatus,
} from '../generated/prisma/enums.js';
import type { UpsertDailyReportDto } from './dto/upsert-daily-report.dto.js';
import type { ExcuseDailyReportDto } from './dto/excuse-daily-report.dto.js';
import type {
  GetDailyReportHistoryQueryDto,
  GetDailyReportQueryDto,
} from './dto/get-daily-report-query.dto.js';

const DEFAULT_HISTORY_DAYS = 45;
const MAX_HISTORY_DAYS = 92;
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
    projectOrClient: string | null;
    status: string;
    expectedMinutes: number | null;
    actualMinutes: number | null;
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

  async upsertMyReport(userId: string, dto: UpsertDailyReportDto) {
    const employeeId = await this.requireEmployeeId(userId);
    const date = dto.date ? parseDateOnly(dto.date) : this.today();

    const today = this.today();
    const daysOld = Math.round((today.getTime() - date.getTime()) / 86_400_000);
    if (daysOld < 0) {
      throw new BadRequestException('Cannot submit a report for a future date');
    }
    if (daysOld > EDITABLE_WINDOW_DAYS) {
      throw new BadRequestException(
        `This date is outside the ${EDITABLE_WINDOW_DAYS + 1}-day window employees can self-edit — ask HR to review it`,
      );
    }

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

      // Simplest correct way to keep task entries in sync with a client-
      // submitted list (adds/removes/reorders all included) - report volume
      // here is one row per employee per day, capped at 30 tasks, so a
      // delete-then-recreate is cheap and avoids diffing logic that isn't
      // worth the complexity for this size of data.
      await tx.dailyReportTaskEntry.deleteMany({ where: { dailyReportId: report.id } });
      if (dto.tasks.length > 0) {
        await tx.dailyReportTaskEntry.createMany({
          data: dto.tasks.map((task, index) => ({
            dailyReportId: report.id,
            title: task.title,
            projectOrClient: task.projectOrClient,
            status: task.status,
            expectedMinutes: task.expectedMinutes,
            actualMinutes: task.actualMinutes,
            output: task.output,
            blockerCategory: task.blockerCategory,
            blockerNote: task.blockerNote,
            sortOrder: index,
          })),
        });
      }
    });

    return this.computeReport(employeeId, date);
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
        include: { tasks: { orderBy: { sortOrder: 'asc' } } },
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
