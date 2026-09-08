import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class NominateEmployeeOfTheMonthDto {
  @IsString()
  @MinLength(1)
  employeeId!: string;

  // Defaults to the current calendar month/year when omitted - the common
  // case is "make this person this month's pick", not backfilling history.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth?: number;

  @IsOptional()
  @IsInt()
  @Min(2000)
  periodYear?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
