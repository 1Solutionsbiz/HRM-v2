import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsIn,
  IsInt,
  IsNumber,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const LINE_ITEM_TYPES = ['EARNING', 'DEDUCTION'] as const;

export class PayslipLineItemDto {
  @IsIn(LINE_ITEM_TYPES)
  type!: (typeof LINE_ITEM_TYPES)[number];

  @IsString()
  @MaxLength(200)
  label!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;
}

/**
 * No formula computes `lineItems` from `SalaryStructure.currentAmount` — the
 * schema has no basic/HRA/PF/tax breakdown model, and inventing percentages
 * (rule 13: don't invent business rules) would fabricate numbers nobody
 * signed off on. HR enters the actual earnings/deductions from wherever
 * payroll is really run; the server only aggregates what's definitional —
 * gross = sum(EARNING), net = gross - sum(DEDUCTION).
 */
export class CreatePayslipDto {
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth!: number;

  @IsInt()
  @Min(2000)
  periodYear!: number;

  @ValidateNested({ each: true })
  @Type(() => PayslipLineItemDto)
  @ArrayMinSize(1)
  lineItems!: PayslipLineItemDto[];
}
