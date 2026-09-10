import { IsDateString, IsOptional, IsString, Matches } from 'class-validator';

/** Standard 10-char Indian PAN, e.g. "AXLPK8778M". */
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
/** 12-digit Aadhaar number. */
const AADHAAR_PATTERN = /^\d{12}$/;

/**
 * PAN and Aadhaar are mandatory per explicit product decision — every other
 * field here is optional. Plaintext in, encrypted before storage (see
 * EmployeesService.upsertIdentification), same as bank account/PAN already
 * were.
 */
export class UpsertIdentificationDto {
  @IsString()
  @Matches(PAN_PATTERN, { message: 'PAN must be in the format AAAAA9999A' })
  panNumber!: string;

  @IsString()
  @Matches(AADHAAR_PATTERN, { message: 'Aadhaar must be exactly 12 digits' })
  aadhaarNumber!: string;

  @IsOptional()
  @IsString()
  passportNumber?: string;

  @IsOptional()
  @IsDateString()
  passportExpiryDate?: string;

  @IsOptional()
  @IsString()
  drivingLicenseNumber?: string;

  @IsOptional()
  @IsDateString()
  drivingLicenseExpiryDate?: string;
}
