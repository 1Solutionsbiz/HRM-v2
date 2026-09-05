import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard.js';
import type { AuthContext } from '../auth-context.js';

function buildContext(authContext: AuthContext | undefined): ExecutionContext {
  return {
    getHandler: () => vi.fn(),
    getClass: () => vi.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ authContext }),
    }),
  } as unknown as ExecutionContext;
}

function buildReflector(required: string[] | undefined) {
  return { getAllAndOverride: vi.fn().mockReturnValue(required) } as any;
}

const grantedAuthContext: AuthContext = {
  userId: 'u1',
  sessionId: 's1',
  email: 'a@example.com',
  roles: ['hr'],
  permissions: ['leave:approve', 'employee:manage'],
};

describe('PermissionsGuard', () => {
  it('passes a route with no @RequirePermissions metadata', () => {
    const guard = new PermissionsGuard(buildReflector(undefined));
    expect(guard.canActivate(buildContext(undefined))).toBe(true);
  });

  it('passes a route declaring an empty permission list', () => {
    const guard = new PermissionsGuard(buildReflector([]));
    expect(guard.canActivate(buildContext(undefined))).toBe(true);
  });

  it('passes when the authContext carries every required permission', () => {
    const guard = new PermissionsGuard(buildReflector(['leave:approve']));
    expect(guard.canActivate(buildContext(grantedAuthContext))).toBe(true);
  });

  it('rejects when a required permission is missing', () => {
    const guard = new PermissionsGuard(buildReflector(['payroll:view']));
    expect(() => guard.canActivate(buildContext(grantedAuthContext))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects rather than silently passing when authContext is absent', () => {
    const guard = new PermissionsGuard(buildReflector(['leave:approve']));
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
