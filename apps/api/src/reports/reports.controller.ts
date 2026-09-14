import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { CronAuthGuard } from '../common/guards/cron-auth.guard.js';
import type { AuthContext } from '../common/auth-context.js';
import { WeeklyAttendanceReportService } from './weekly-attendance-report.service.js';
import { SendTestWeeklyReportDto } from './dto/send-test-weekly-report.dto.js';

@Controller('reports')
@RequirePermissions('attendance:manage')
export class ReportsController {
  constructor(private readonly weeklyAttendanceReportService: WeeklyAttendanceReportService) {}

  @Post('weekly-attendance/test')
  sendTest(@CurrentUser() actor: AuthContext, @Body() dto: SendTestWeeklyReportDto) {
    return this.weeklyAttendanceReportService.sendTestReports(actor.email, dto.to ?? actor.email);
  }

  /** External-scheduler trigger (see CronAuthGuard) — runs the same job as the Saturday 8 AM @Cron. */
  @Post('cron/weekly-attendance')
  @Public()
  @RequirePermissions()
  @UseGuards(CronAuthGuard)
  runWeeklyAttendanceReportCron() {
    return this.weeklyAttendanceReportService.sendWeeklyReports();
  }
}
