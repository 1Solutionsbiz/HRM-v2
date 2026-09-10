import { IsEnum, IsOptional, ValidateIf } from 'class-validator';
import { DailyReportTemplate } from '../../generated/prisma/enums.js';

export class UpdateDesignationDto {
  /** Explicit null clears the override back to the GENERAL fallback; omitted leaves it unchanged. */
  @ValidateIf((o: UpdateDesignationDto) => o.dailyReportTemplate !== null)
  @IsOptional()
  @IsEnum(DailyReportTemplate)
  dailyReportTemplate?: DailyReportTemplate | null;
}
