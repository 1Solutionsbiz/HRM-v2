import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import {
  BlockerCategory,
  DailyReportTaskStatus,
} from '../../generated/prisma/enums.js';

const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Everything but a title is optional - this is the shape a draft save
 * accepts (see DailyReportsService.saveDraft), for a task someone is
 * still filling in and wants to come back to later. DailyReportTaskEntryDto
 * (no "Draft" suffix) stays the strict, fully-required shape used only by
 * the final submit.
 */
export class DailyReportTaskEntryDraftDto {
  @IsString()
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsEnum(DailyReportTaskStatus)
  status?: DailyReportTaskStatus;

  @IsOptional()
  @Matches(TIME_OF_DAY_PATTERN, { message: 'startTime must be in HH:mm format' })
  startTime?: string;

  @IsOptional()
  @Matches(TIME_OF_DAY_PATTERN, { message: 'endTime must be in HH:mm format' })
  endTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  output?: string;

  @IsOptional()
  @IsEnum(BlockerCategory)
  blockerCategory?: BlockerCategory;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  blockerNote?: string;
}
