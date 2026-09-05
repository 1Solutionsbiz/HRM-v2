import { IsDateString, IsString, MaxLength } from 'class-validator';

export class CreateHolidayDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsDateString()
  date!: string;
}
