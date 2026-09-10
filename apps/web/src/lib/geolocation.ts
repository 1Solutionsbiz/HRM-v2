import type { PunchLocation } from "@/lib/api/attendance";

/**
 * Best-effort only - always resolves, never rejects. Permission denied, no
 * geolocation support, or a timeout all resolve to undefined rather than
 * throwing, so a caller can send whatever it gets straight to the API and
 * let the backend decide whether a location was actually required (see
 * AttendanceService.assertWithinGeofence) - the frontend doesn't need to
 * know the office's geofencing policy.
 */
export function getCurrentLocation(): Promise<PunchLocation | undefined> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      resolve(undefined);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  });
}
