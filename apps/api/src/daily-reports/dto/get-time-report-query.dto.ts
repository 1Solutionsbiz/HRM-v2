import { IsDateString, IsString, MinLength } from 'class-validator';

export class GetEmployeeTimeReportQueryDto {
  @IsString()
  @MinLength(1)
  employeeId!: string;

  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}

export class GetProjectTimeReportQueryDto {
  @IsString()
  @MinLength(1)
  projectId!: string;

  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}
