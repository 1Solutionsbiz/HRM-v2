import { describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { CronAuthGuard } from './cron-auth.guard.js';

function buildContext(authorizationHeader?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization: authorizationHeader } }),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('CronAuthGuard', () => {
  it('refuses every request when CRON_SECRET is not configured', () => {
    const configService = { get: vi.fn().mockReturnValue(undefined) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const guard = new CronAuthGuard(configService as any);
    expect(() => guard.canActivate(buildContext('Bearer anything'))).toThrow(ServiceUnavailableException);
  });

  it('rejects a missing or wrong bearer token', () => {
    const configService = { get: vi.fn().mockReturnValue('the-real-secret') };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const guard = new CronAuthGuard(configService as any);
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(buildContext('Bearer wrong-secret'))).toThrow(UnauthorizedException);
  });

  it('allows the request through with the correct bearer token', () => {
    const configService = { get: vi.fn().mockReturnValue('the-real-secret') };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const guard = new CronAuthGuard(configService as any);
    expect(guard.canActivate(buildContext('Bearer the-real-secret'))).toBe(true);
  });
});
