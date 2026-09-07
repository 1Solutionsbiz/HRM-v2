import { IsString, MaxLength } from 'class-validator';

export class AddTicketCommentDto {
  @IsString()
  @MaxLength(2000)
  body!: string;
}
