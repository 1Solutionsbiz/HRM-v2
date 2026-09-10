import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

export class ExcuseDailyReportDto {
  @IsDateString()
  date!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}
