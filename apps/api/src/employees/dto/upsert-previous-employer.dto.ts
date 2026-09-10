import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertPreviousEmployerDto {
  @IsString()
  @MaxLength(200)
  companyName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  designation?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}
