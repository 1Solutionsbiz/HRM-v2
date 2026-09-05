import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { RolesController } from './roles.controller.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersController, RolesController],
  providers: [UsersService],
  // EmployeesModule (03) calls UsersService.create() directly to provision
  // the auth account when onboarding a new hire.
  exports: [UsersService],
})
export class UsersModule {}
