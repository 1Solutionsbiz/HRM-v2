import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { TicketCategory, TicketPriority } from '../../generated/prisma/enums.js';

export class CreateTicketDto {
  @IsIn(Object.values(TicketCategory))
  category!: TicketCategory;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(2000)
  description!: string;

  @IsOptional()
  @IsIn(Object.values(TicketPriority))
  priority?: TicketPriority;
}
