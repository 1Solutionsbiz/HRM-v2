import { Module } from '@nestjs/common';
import { LeaveModule } from '../leave/leave.module.js';
import { ExpensesModule } from '../expenses/expenses.module.js';
import { RequestsController } from './requests.controller.js';
import { RequestsService } from './requests.service.js';

@Module({
  imports: [LeaveModule, ExpensesModule],
  controllers: [RequestsController],
  providers: [RequestsService],
})
export class RequestsModule {}
