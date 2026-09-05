import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  /**
   * 12-char minimum is a new requirement, not an inspected legacy rule —
   * the legacy audit found no password policy at all (rule 13 doesn't apply
   * here; there was nothing to inspect).
   */
  @IsString()
  @MinLength(12)
  @MaxLength(200)
  newPassword!: string;
}
