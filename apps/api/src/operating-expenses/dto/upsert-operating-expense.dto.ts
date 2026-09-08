import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { OperatingExpenseCategory } from '../../generated/prisma/enums.js';

export class UpsertOperatingExpenseDto {
  @IsIn(Object.values(OperatingExpenseCategory))
  category!: OperatingExpenseCategory;

  // Required only for CUSTOM (multiple CUSTOM rows can coexist per period,
  // distinguished by this) — the 4 standard categories are one row per
  // period regardless of what's sent here, so the service ignores it there.
  @ValidateIf((dto: UpsertOperatingExpenseDto) => dto.category === 'CUSTOM')
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label?: string;

  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth!: number;

  @IsInt()
  @Min(2000)
  periodYear!: number;

  // `Decimal(12, 2)` in the DB — reject what the column can't represent
  // exactly rather than let MySQL silently round it on insert.
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
