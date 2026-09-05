import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

/** `timezone` is deliberately excluded — the frontend renders it disabled, and the schema's default is the only source today. */
export class UpdateCompanySettingsDto {
  @IsString()
  @MaxLength(200)
  legalName!: string;

  @IsString()
  @MaxLength(200)
  brandName!: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  website?: string;

  @IsEmail()
  supportEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  address?: string;
}
