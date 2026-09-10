import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { DailyReportsController } from './daily-reports.controller.js';
import { DailyReportsService } from './daily-reports.service.js';
import { DailyReportRemindersService } from './daily-report-reminders.service.js';

/**
 * P1 Daily Work Reporting. Deliberately has no dependency on AttendanceModule
 * — per the approved P0 plan, Missing Report is a reporting-compliance
 * concept only in this phase, never written back to Attendance. It reads
 * Holiday/LeaveRequest/AttendancePolicy directly (shared, read-only data)
 * rather than importing AttendanceService, so this module can't accidentally
 * call anything that mutates an AttendanceDay/AttendanceEvent row.
 */
@Module({
  imports: [NotificationsModule],
  controllers: [DailyReportsController],
  providers: [DailyReportsService, DailyReportRemindersService],
})
export class DailyReportsModule {}
