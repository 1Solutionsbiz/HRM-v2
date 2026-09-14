import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { CronAuthGuard } from '../common/guards/cron-auth.guard.js';
import type { AuthContext } from '../common/auth-context.js';
import { DailyReportsService } from './daily-reports.service.js';
import { DailyReportRemindersService } from './daily-report-reminders.service.js';
import { SubmitDailyReportDto } from './dto/submit-daily-report.dto.js';
import { SaveDailyReportDraftDto } from './dto/save-daily-report-draft.dto.js';
import { ExcuseDailyReportDto } from './dto/excuse-daily-report.dto.js';
import {
  GetDailyReportHistoryQueryDto,
  GetDailyReportQueryDto,
} from './dto/get-daily-report-query.dto.js';
import {
  GetEmployeeTimeReportQueryDto,
  GetProjectTimeReportQueryDto,
} from './dto/get-time-report-query.dto.js';

/**
 * Class-level performance:manage covers the team/employee/excuse routes
 * below (already granted to manager/hr/admin — see seed.ts); the two /me
 * routes override it back to "just logged in" via a bare
 * @RequirePermissions(), same pattern as EmployeesController. Registered
 * before the :employeeId routes so Nest/Express match "me" as the literal
 * segment it is, not as an :employeeId param.
 */
@Controller('daily-reports')
@RequirePermissions('performance:manage')
export class DailyReportsController {
  constructor(
    private readonly dailyReportsService: DailyReportsService,
    private readonly dailyReportRemindersService: DailyReportRemindersService,
  ) {}

  @Get('me')
  @RequirePermissions()
  getMine(@CurrentUser() actor: AuthContext, @Query() query: GetDailyReportQueryDto) {
    return this.dailyReportsService.getMyReport(actor.userId, query);
  }

  @Get('me/history')
  @RequirePermissions()
  getMyHistory(@CurrentUser() actor: AuthContext, @Query() query: GetDailyReportHistoryQueryDto) {
    return this.dailyReportsService.getMyHistory(actor.userId, query);
  }

  /** Saves progress without submitting - see DailyReportsService.saveDraft. */
  @Put('me')
  @RequirePermissions()
  saveDraft(@CurrentUser() actor: AuthContext, @Body() dto: SaveDailyReportDraftDto) {
    return this.dailyReportsService.saveDraft(actor.userId, dto);
  }

  /** The final submission - see DailyReportsService.submitMyReport. */
  @Post('me/submit')
  @RequirePermissions()
  submitMine(@CurrentUser() actor: AuthContext, @Body() dto: SubmitDailyReportDto) {
    return this.dailyReportsService.submitMyReport(actor.userId, dto);
  }

  /** Manager: own direct reports only. HR/admin: everyone — see DailyReportsService.resolveTeamScope. */
  @Get('team')
  getTeam(@CurrentUser() actor: AuthContext, @Query('date') date?: string) {
    return this.dailyReportsService.getTeamReports(actor, date);
  }

  /** Same scope rule as 'team' - registered before the :employeeId routes so "blockers" is never matched as an id. */
  @Get('blockers')
  getBlockerBreakdown(@CurrentUser() actor: AuthContext, @Query() query: GetDailyReportHistoryQueryDto) {
    return this.dailyReportsService.getBlockerBreakdown(actor, query);
  }

  /**
   * hr/admin-only, unlike the class-level performance:manage above (which
   * manager also holds) - a manager pulling any employee's full time
   * breakdown by hitting this directly isn't something performance:manage
   * was ever meant to grant. See DailyReportsService.getEmployeeTimeReport.
   */
  @Get('analytics/by-employee')
  @RequirePermissions('attendance:manage')
  getEmployeeTimeReport(@Query() query: GetEmployeeTimeReportQueryDto) {
    return this.dailyReportsService.getEmployeeTimeReport(query);
  }

  /** Same access rule as by-employee above. See DailyReportsService.getProjectTimeReport. */
  @Get('analytics/by-project')
  @RequirePermissions('attendance:manage')
  getProjectTimeReport(@Query() query: GetProjectTimeReportQueryDto) {
    return this.dailyReportsService.getProjectTimeReport(query);
  }

  @Get('employees/:employeeId')
  getEmployeeReport(
    @CurrentUser() actor: AuthContext,
    @Param('employeeId') employeeId: string,
    @Query() query: GetDailyReportQueryDto,
  ) {
    return this.dailyReportsService.getEmployeeReport(actor, employeeId, query);
  }

  @Get('employees/:employeeId/history')
  getEmployeeHistory(
    @CurrentUser() actor: AuthContext,
    @Param('employeeId') employeeId: string,
    @Query() query: GetDailyReportHistoryQueryDto,
  ) {
    return this.dailyReportsService.getEmployeeHistory(actor, employeeId, query);
  }

  @Post('employees/:employeeId/excuse')
  excuse(
    @CurrentUser() actor: AuthContext,
    @Param('employeeId') employeeId: string,
    @Body() dto: ExcuseDailyReportDto,
  ) {
    return this.dailyReportsService.excuse(actor, employeeId, dto);
  }

  /** Admin-only, stricter than the class default - fires both reminder notifications for the caller only, never a real employee. See DailyReportRemindersService.sendTest. */
  @Post('reminders/test')
  @RequirePermissions('company:manage')
  sendTestReminder(@CurrentUser() actor: AuthContext) {
    return this.dailyReportRemindersService.sendTest(actor.userId);
  }

  /** External-scheduler trigger (see CronAuthGuard) — runs the same job as the every-15-min @Cron. */
  @Post('cron/reminders')
  @Public()
  @RequirePermissions()
  @UseGuards(CronAuthGuard)
  runReminderCron() {
    return this.dailyReportRemindersService.checkAndNotify();
  }
}
