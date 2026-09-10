import { IsBoolean, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class UpdateDailyReportPolicyDto {
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  /** 24-hour "HH:mm", company local time — e.g. "18:00". */
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'deadline must be in HH:mm 24-hour format' })
  deadline?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  graceMinutes?: number;
}
