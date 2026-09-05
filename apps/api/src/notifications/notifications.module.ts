import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  // Other modules (Leave, Expenses, ...) inject this to create
  // notifications when something happens a user should know about.
  exports: [NotificationsService],
})
export class NotificationsModule {}
