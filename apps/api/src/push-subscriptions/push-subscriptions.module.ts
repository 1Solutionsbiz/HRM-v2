import { Module } from '@nestjs/common';
import { PushSubscriptionsController } from './push-subscriptions.controller.js';
import { PushSubscriptionsService } from './push-subscriptions.service.js';

@Module({
  controllers: [PushSubscriptionsController],
  providers: [PushSubscriptionsService],
  // NotificationsModule imports this to send a push alongside every
  // in-app notification it creates.
  exports: [PushSubscriptionsService],
})
export class PushSubscriptionsModule {}
