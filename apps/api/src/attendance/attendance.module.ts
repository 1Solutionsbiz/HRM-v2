import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';
import { MissingCheckoutReminderService } from './missing-checkout-reminder.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, MissingCheckoutReminderService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
