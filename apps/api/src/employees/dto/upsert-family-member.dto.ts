import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Shared shape for children/other-dependents/nominees — the `kind`
 * discriminator is set by the controller route, not this body, so a client
 * can't add a child through the nominee endpoint by mistake.
 */
export class UpsertFamilyMemberDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  relationship?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  sharePercentage?: number;
}
