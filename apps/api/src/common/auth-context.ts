/**
 * Attached to `request.authContext` by `JwtAuthGuard` after it verifies the
 * access token AND looks up the backing `Session` row — see that guard for
 * why roles/permissions are resolved per-request rather than read from the
 * token.
 */
export interface AuthContext {
  userId: string;
  sessionId: string;
  email: string;
  roles: string[];
  permissions: string[];
}
