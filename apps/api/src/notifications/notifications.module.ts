import { Module } from '@nestjs/common';
import { PushSubscriptionsModule } from '../push-subscriptions/push-subscriptions.module.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [PushSubscriptionsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  // Other modules (Leave, Expenses, ...) inject this to create
  // notifications when something happens a user should know about.
  exports: [NotificationsService],
})
export class NotificationsModule {}
