import { IsString, MaxLength } from 'class-validator';

export class UpdateProjectDto {
  @IsString()
  @MaxLength(150)
  name!: string;
}
