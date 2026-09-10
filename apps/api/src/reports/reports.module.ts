import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module.js';
import { WeeklyAttendanceReportService } from './weekly-attendance-report.service.js';

@Module({
  imports: [AttendanceModule],
  providers: [WeeklyAttendanceReportService],
})
export class ReportsModule {}
