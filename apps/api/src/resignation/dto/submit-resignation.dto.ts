import { IsDateString, IsString, MaxLength } from 'class-validator';

export class SubmitResignationDto {
  @IsString()
  @MaxLength(2000)
  reason!: string;

  @IsDateString()
  lastWorkingDay!: string;
}
