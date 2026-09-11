import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SearchEmployeesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
