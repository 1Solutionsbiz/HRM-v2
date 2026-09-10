import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
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
}
