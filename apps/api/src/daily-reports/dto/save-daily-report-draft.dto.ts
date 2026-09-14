import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { DailyReportTaskEntryDraftDto } from './daily-report-task-entry-draft.dto.js';

/**
 * Saves progress without submitting - every field optional (including
 * tasks itself), so this accepts "just the title so far", "summary but no
 * tasks yet", or anything in between. See DailyReportsService.saveDraft:
 * unlike a submit, this never sets status/submittedAt.
 */
export class SaveDailyReportDraftDto {
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

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DailyReportTaskEntryDraftDto)
  @ArrayMaxSize(30)
  tasks?: DailyReportTaskEntryDraftDto[];
}
