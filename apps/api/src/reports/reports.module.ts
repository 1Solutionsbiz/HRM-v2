import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module.js';
import { ReportsController } from './reports.controller.js';
import { WeeklyAttendanceReportService } from './weekly-attendance-report.service.js';

@Module({
  imports: [AttendanceModule],
  controllers: [ReportsController],
  providers: [WeeklyAttendanceReportService],
})
export class ReportsModule {}
