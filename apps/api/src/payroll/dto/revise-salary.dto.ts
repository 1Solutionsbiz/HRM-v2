import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class ReviseSalaryDto {
  @IsNumber()
  @IsPositive()
  newAmount!: number;

  @IsDateString()
  effectiveDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
