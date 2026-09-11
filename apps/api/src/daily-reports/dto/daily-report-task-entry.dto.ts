import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
import {
  BlockerCategory,
  DailyReportTaskStatus,
} from '../../generated/prisma/enums.js';

export class DailyReportTaskEntryDto {
  @IsString()
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsEnum(DailyReportTaskStatus)
  status!: DailyReportTaskStatus;

  @IsOptional()
  @Matches(TIME_OF_DAY_PATTERN, { message: 'startTime must be in HH:mm format' })
  startTime?: string;

  @IsOptional()
  @Matches(TIME_OF_DAY_PATTERN, { message: 'endTime must be in HH:mm format' })
  endTime?: string;

  // Minutes, not hours - avoids float rounding on something that drives
  // time-variance math later, same reasoning as AttendanceDay.workedMinutes.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24 * 60)
  expectedMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24 * 60)
  actualMinutes?: number;

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
