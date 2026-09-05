import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { EmployeesController } from './employees.controller.js';
import { DepartmentsController } from './departments.controller.js';
import { DesignationsController } from './designations.controller.js';
import { EmployeesService } from './employees.service.js';

@Module({
  imports: [UsersModule],
  controllers: [
    EmployeesController,
    DepartmentsController,
    DesignationsController,
  ],
  providers: [EmployeesService],
})
export class EmployeesModule {}
