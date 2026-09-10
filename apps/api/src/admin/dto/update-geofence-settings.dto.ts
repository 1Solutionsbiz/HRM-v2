import { IsInt, IsLatitude, IsLongitude, IsOptional, Max, Min } from 'class-validator';

/**
 * All three fields together (turn geofencing on) or all three omitted (turn
 * it off) - enforced in AdminService.updateGeofenceSettings, not here,
 * since class-validator's per-field @IsOptional() can't express "these
 * three are a unit."
 */
export class UpdateGeofenceSettingsDto {
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(5000)
  radiusMeters?: number;
}
