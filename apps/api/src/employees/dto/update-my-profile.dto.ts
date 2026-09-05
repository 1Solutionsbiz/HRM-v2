import { IsDateString, IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { BloodGroup, Gender, MaritalStatus } from '../../generated/prisma/enums.js';

/**
 * The self-service subset of UpdateEmployeeDto — deliberately excludes
 * firstName/lastName/employmentType/status/departmentId/designationId/
 * managerId/workLocation/avatarUrl. Identity and employment facts stay
 * HR-controlled via PATCH /employees/:id; this is only the fields an
 * employee should be able to correct about themselves. The global
 * ValidationPipe's whitelist/forbidNonWhitelisted rejects any other field
 * outright, so this is a real boundary, not just documentation.
 */
export class UpdateMyProfileDto {
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
  @IsString()
  currentAddress?: string;

  @IsOptional()
  @IsIn(Object.values(Gender))
  gender?: Gender;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nationality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  religion?: string;

  @IsOptional()
  @IsIn(Object.values(MaritalStatus))
  maritalStatus?: MaritalStatus;

  @IsOptional()
  @IsIn(Object.values(BloodGroup))
  bloodGroup?: BloodGroup;
}
