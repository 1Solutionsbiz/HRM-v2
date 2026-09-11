import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { DailyReportsService } from './daily-reports.service.js';
import { DailyReportRemindersService } from './daily-report-reminders.service.js';
import { UpsertDailyReportDto } from './dto/upsert-daily-report.dto.js';
import { ExcuseDailyReportDto } from './dto/excuse-daily-report.dto.js';
import {
  GetDailyReportHistoryQueryDto,
  GetDailyReportQueryDto,
} from './dto/get-daily-report-query.dto.js';

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

  @Put('me')
  @RequirePermissions()
  upsertMine(@CurrentUser() actor: AuthContext, @Body() dto: UpsertDailyReportDto) {
    return this.dailyReportsService.upsertMyReport(actor.userId, dto);
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
}
