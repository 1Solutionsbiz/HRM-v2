import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;

  /**
   * Optional today — the built login UI doesn't send one yet
   * (`apps/web/src/app/login/page.tsx` only posts email/password). When
   * present, ties the session to a `Device` row for the security/device
   * screens; when absent, the session is created without one.
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  deviceFingerprint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  deviceLabel?: string;
}
