import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertBankDetailDto {
  @IsString()
  @MaxLength(200)
  bankName!: string;

  /** Plaintext in, encrypted before storage — see EmployeesService.upsertBankDetail. */
  @IsString()
  @MaxLength(64)
  accountNumber!: string;

  @IsString()
  @MaxLength(20)
  ifscCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  panNumber?: string;
}
