import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { RolesController } from './roles.controller.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersController, RolesController],
  providers: [UsersService],
})
export class UsersModule {}
