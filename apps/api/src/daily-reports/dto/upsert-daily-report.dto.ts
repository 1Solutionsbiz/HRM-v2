import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { DailyReportTaskEntryDto } from './daily-report-task-entry.dto.js';

export class UpsertDailyReportDto {
  /** Defaults to today when omitted - see DailyReportsService's editable-window check for what dates this actually accepts. */
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  blockers?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  tomorrowPlan?: string;

  @ValidateNested({ each: true })
  @Type(() => DailyReportTaskEntryDto)
  @ArrayMaxSize(30)
  tasks!: DailyReportTaskEntryDto[];
}
