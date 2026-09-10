import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
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
  @MaxLength(200)
  projectOrClient?: string;

  @IsEnum(DailyReportTaskStatus)
  status!: DailyReportTaskStatus;

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
