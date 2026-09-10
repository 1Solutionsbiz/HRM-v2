import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  DailyReportTemplate,
  EmployeeStatus,
  EmploymentType,
} from '../../generated/prisma/enums.js';

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  personalEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsIn(Object.values(EmploymentType))
  employmentType?: EmploymentType;

  @IsOptional()
  @IsIn(Object.values(EmployeeStatus))
  status?: EmployeeStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  workLocation?: string;

  @IsOptional()
  @IsString()
  currentAddress?: string;

  @IsOptional()
  @IsString()
  permanentAddress?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  designationId?: string;

  @IsOptional()
  @IsString()
  managerId?: string;

  /** Wins over the Designation's template when set; explicit null clears it back to the Designation/GENERAL fallback. */
  @ValidateIf((o: UpdateEmployeeDto) => o.dailyReportTemplateOverride !== null)
  @IsOptional()
  @IsEnum(DailyReportTemplate)
  dailyReportTemplateOverride?: DailyReportTemplate | null;

  @IsOptional()
  @IsBoolean()
  dailyReportExempt?: boolean;
}
