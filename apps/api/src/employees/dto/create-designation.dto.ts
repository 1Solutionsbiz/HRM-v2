import { IsString, MaxLength } from 'class-validator';

export class CreateDesignationDto {
  @IsString()
  @MaxLength(100)
  title!: string;

  @IsString()
  departmentId!: string;
}
