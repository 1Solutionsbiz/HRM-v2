import { IsDateString, IsOptional } from 'class-validator';

export class GetDailyReportQueryDto {
  /** Defaults to today when omitted. */
  @IsOptional()
  @IsDateString()
  date?: string;
}

export class GetDailyReportHistoryQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
