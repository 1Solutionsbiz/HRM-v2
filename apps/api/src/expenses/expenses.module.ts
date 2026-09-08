import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ExpensesController } from './expenses.controller.js';
import { ExpensesService } from './expenses.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  // RequestsModule (07) aggregates expense claims into the unified "My
  // Requests" view.
  exports: [ExpensesService],
})
export class ExpensesModule {}
