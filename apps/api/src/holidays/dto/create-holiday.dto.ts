import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const HOLIDAY_TYPES = ['FIXED', 'NATIONAL'] as const;

export class CreateHolidayDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsIn(HOLIDAY_TYPES)
  type?: (typeof HOLIDAY_TYPES)[number];
}
