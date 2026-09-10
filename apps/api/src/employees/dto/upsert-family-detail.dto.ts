import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertFamilyDetailDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fatherName?: string;

  @IsOptional()
  @IsDateString()
  fatherDateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  motherName?: string;

  @IsOptional()
  @IsDateString()
  motherDateOfBirth?: string;
}
