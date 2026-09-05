import { ArrayUnique, IsArray, IsString } from 'class-validator';

export class ReplaceRolesDto {
  /** The full desired role set, replacing whatever the user currently has. Empty array revokes every role. */
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  roleKeys!: string[];
}
