import { Module } from '@nestjs/common';
import { TicketController } from './ticket.controller.js';
import { TicketService } from './ticket.service.js';

@Module({
  controllers: [TicketController],
  providers: [TicketService],
})
export class TicketModule {}
