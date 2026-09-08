import { Module } from '@nestjs/common';
import { EmployeeOfTheMonthController } from './employee-of-the-month.controller.js';
import { EmployeeOfTheMonthService } from './employee-of-the-month.service.js';

@Module({
  controllers: [EmployeeOfTheMonthController],
  providers: [EmployeeOfTheMonthService],
})
export class EmployeeOfTheMonthModule {}
