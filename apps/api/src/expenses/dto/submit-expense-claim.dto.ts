import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class SubmitExpenseClaimDto {
  @IsString()
  categoryId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsDateString()
  expenseDate!: string;

  @IsString()
  @MaxLength(1000)
  description!: string;

  /** Same limitation as Documents: no file storage integration, so this is a URL, not a file body. */
  @IsOptional()
  @IsUrl()
  @MaxLength(2000)
  receiptUrl?: string;
}
