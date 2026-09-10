-- AlterTable
ALTER TABLE `company_settings`
  ADD COLUMN `geofenceLatitude` DOUBLE NULL,
  ADD COLUMN `geofenceLongitude` DOUBLE NULL,
  ADD COLUMN `geofenceRadiusMeters` INTEGER NULL;

-- AlterTable
ALTER TABLE `attendance_events`
  ADD COLUMN `latitude` DOUBLE NULL,
  ADD COLUMN `longitude` DOUBLE NULL;
