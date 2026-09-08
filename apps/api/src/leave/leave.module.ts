import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { LeaveController } from './leave.controller.js';
import { LeaveService } from './leave.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [LeaveController],
  providers: [LeaveService],
  // RequestsModule (07) aggregates leave requests into the unified "My
  // Requests" view.
  exports: [LeaveService],
})
export class LeaveModule {}
