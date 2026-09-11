import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  /** Archive/unarchive - an archived project drops out of the Daily Report dropdown but existing task entries keep referencing it fine. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
