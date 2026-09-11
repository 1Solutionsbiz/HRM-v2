import {
  IsEnum,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
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

  @IsString()
  projectId!: string;

  @IsEnum(DailyReportTaskStatus)
  status!: DailyReportTaskStatus;

  @Matches(TIME_OF_DAY_PATTERN, { message: 'startTime must be in HH:mm format' })
  startTime!: string;

  @Matches(TIME_OF_DAY_PATTERN, { message: 'endTime must be in HH:mm format' })
  endTime!: string;

  // Minutes, not hours - avoids float rounding on something that drives
  // time-variance math later, same reasoning as AttendanceDay.workedMinutes.
  @IsInt()
  @Min(0)
  @Max(24 * 60)
  expectedMinutes!: number;

  @IsInt()
  @Min(0)
  @Max(24 * 60)
  actualMinutes!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  output!: string;

  // Required only for a BLOCKED task - a task that isn't blocked has no
  // blocker to describe, so these stay entirely unvalidated (undefined is
  // fine) rather than forcing a placeholder value in.
  @ValidateIf((entry: DailyReportTaskEntryDto) => entry.status === 'BLOCKED')
  @IsEnum(BlockerCategory)
  blockerCategory?: BlockerCategory;

  @ValidateIf((entry: DailyReportTaskEntryDto) => entry.status === 'BLOCKED')
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  blockerNote?: string;
}
