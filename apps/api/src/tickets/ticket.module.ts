import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { TicketController } from './ticket.controller.js';
import { TicketService } from './ticket.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [TicketController],
  providers: [TicketService],
})
export class TicketModule {}
