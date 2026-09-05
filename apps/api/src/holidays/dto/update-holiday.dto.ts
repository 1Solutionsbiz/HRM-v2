import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateHolidayDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}
