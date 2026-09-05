import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class ReviseSalaryDto {
  // `Decimal(12, 2)` in the DB — reject what the column can't represent
  // exactly rather than let MySQL silently round it on insert.
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  newAmount!: number;

  @IsDateString()
  effectiveDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
