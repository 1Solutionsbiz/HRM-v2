import { Module } from '@nestjs/common';
import { OperatingExpensesController } from './operating-expenses.controller.js';
import { OperatingExpensesService } from './operating-expenses.service.js';

@Module({
  controllers: [OperatingExpensesController],
  providers: [OperatingExpensesService],
})
export class OperatingExpensesModule {}
