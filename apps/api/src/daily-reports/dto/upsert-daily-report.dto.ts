import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DailyReportTaskEntryDto } from './daily-report-task-entry.dto.js';

export class UpsertDailyReportDto {
  /** Defaults to today when omitted - see DailyReportsService's editable-window check for what dates this actually accepts. */
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  summary!: string;

  // Left optional deliberately - most days have nothing blocked, and
  // forcing text into this box daily would just train people to type a
  // throwaway "none" (see BLOCKED-only requirement on the per-task
  // blocker fields, which is where a real blocker is actually captured).
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  blockers?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  tomorrowPlan!: string;

  @ValidateNested({ each: true })
  @Type(() => DailyReportTaskEntryDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  tasks!: DailyReportTaskEntryDto[];
}
