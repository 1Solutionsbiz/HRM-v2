import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { HalfDayPeriod, LeaveDayType } from '../../generated/prisma/enums.js';

export class ApplyLeaveDto {
  @IsString()
  leaveTypeId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsIn(Object.values(LeaveDayType))
  dayType?: LeaveDayType;

  @IsOptional()
  @IsIn(Object.values(HalfDayPeriod))
  halfDayPeriod?: HalfDayPeriod;

  @IsString()
  @MaxLength(1000)
  reason!: string;
}
