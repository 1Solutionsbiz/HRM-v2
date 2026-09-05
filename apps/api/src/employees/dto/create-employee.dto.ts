import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { EmploymentType } from '../../generated/prisma/enums.js';

export class CreateEmployeeDto {
  /** Provisions the linked `User` account — see EmployeesService.create. */
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  roleKeys?: string[];

  @IsString()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MaxLength(100)
  lastName!: string;

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

  @IsDateString()
  dateOfJoining!: string;

  @IsOptional()
  @IsIn(Object.values(EmploymentType))
  employmentType?: EmploymentType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  workLocation?: string;

  @IsOptional()
  @IsString()
  currentAddress?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  designationId?: string;

  @IsOptional()
  @IsString()
  managerId?: string;
}
