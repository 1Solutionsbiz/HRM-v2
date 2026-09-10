import { IsLatitude, IsLongitude, IsNumber, IsOptional } from 'class-validator';

/**
 * Optional at the DTO level on purpose - whether location is actually
 * required depends on whether an admin has configured geofencing
 * (CompanySettings.geofence*), which AttendanceService checks at runtime,
 * not here.
 */
export class PunchLocationDto {
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsNumber()
  accuracy?: number;
}
