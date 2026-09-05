import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  /**
   * Defaults to `['employee']` when omitted — that's the frontend's default
   * "preview as" role (`apps/web/src/types/role.ts`). No self-registration
   * exists (rule: provisioning is admin-driven); this is the only way a
   * `User` row gets created.
   */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  roleKeys?: string[];
}
