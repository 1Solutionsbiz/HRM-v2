import { IsIn } from 'class-validator';
import { TicketStatus } from '../../generated/prisma/enums.js';

export class UpdateTicketStatusDto {
  @IsIn(Object.values(TicketStatus))
  status!: TicketStatus;
}
