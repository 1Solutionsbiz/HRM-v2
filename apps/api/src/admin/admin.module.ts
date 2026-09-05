import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  // Delegates single-role assignment to UsersService.replaceRoles rather
  // than re-implementing role writes.
  imports: [UsersModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
