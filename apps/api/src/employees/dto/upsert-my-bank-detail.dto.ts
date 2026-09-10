import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Self-service counterpart to UpsertBankDetailDto. accountNumber is optional
 * here (unlike the HR-facing DTO): the frontend never re-shows the real
 * number after the first save, so leaving it blank means "keep what's on
 * file" rather than "clear it" — see EmployeesService.upsertMyBankDetail.
 */
export class UpsertMyBankDetailDto {
  @IsString()
  @MaxLength(200)
  bankName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  accountNumber?: string;

  @IsString()
  @MaxLength(20)
  ifscCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  branch?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;
}
