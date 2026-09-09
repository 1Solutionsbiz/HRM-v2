import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(1)
  token!: string;

  /** Same 12-char minimum as ChangePasswordDto.newPassword. */
  @IsString()
  @MinLength(12)
  @MaxLength(200)
  newPassword!: string;
}
