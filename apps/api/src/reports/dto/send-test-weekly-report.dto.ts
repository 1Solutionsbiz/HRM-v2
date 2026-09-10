import { IsEmail, IsOptional } from 'class-validator';

export class SendTestWeeklyReportDto {
  /** Defaults to the caller's own email when omitted. */
  @IsOptional()
  @IsEmail()
  to?: string;
}
