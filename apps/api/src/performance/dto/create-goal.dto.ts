import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateGoalDto {
  @IsString()
  cycleId!: string;

  @IsString()
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
