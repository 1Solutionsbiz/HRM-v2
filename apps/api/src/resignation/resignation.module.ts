import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ResignationController } from './resignation.controller.js';
import { ResignationService } from './resignation.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [ResignationController],
  providers: [ResignationService],
})
export class ResignationModule {}
