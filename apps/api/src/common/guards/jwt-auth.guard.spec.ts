import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard.js';

function buildContext(
  request: Record<string, unknown>,
  isPublic = false,
): {
  context: ExecutionContext;
  reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
} {
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(isPublic) };
  const context = {
    getHandler: () => vi.fn(),
    getClass: () => vi.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, reflector };
}

const futureDate = () => new Date(Date.now() + 60_000);
const pastDate = () => new Date(Date.now() - 60_000);

function buildSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    userId: 'u1',
    revokedAt: null,
    expiresAt: futureDate(),
    user: {
      email: 'a@example.com',
      isActive: true,
      userRoles: [
        {
          role: {
            key: 'hr',
            rolePermissions: [
              { permission: { key: 'leave:approve' } },
              { permission: { key: 'employee:manage' } },
            ],
          },
        },
      ],
    },
    ...overrides,
  };
}

describe('JwtAuthGuard', () => {
  let jwtService: { verifyAsync: ReturnType<typeof vi.fn> };
  let prisma: {
    session: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jwtService = { verifyAsync: vi.fn() };
    prisma = {
      session: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue(undefined),
      },
    };
  });

  it('allows a @Public() route without touching the token or the database', async () => {
    const { context, reflector } = buildContext({ headers: {} }, true);
    guard = new JwtAuthGuard(
      reflector as any,
      jwtService as any,
      prisma as any,
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    expect(prisma.session.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a request with no Authorization header', async () => {
    const { context, reflector } = buildContext({ headers: {} });
    guard = new JwtAuthGuard(
      reflector as any,
      jwtService as any,
      prisma as any,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token that fails signature verification', async () => {
    const { context, reflector } = buildContext({
      headers: { authorization: 'Bearer bad.token' },
    });
    jwtService.verifyAsync.mockRejectedValue(new Error('bad signature'));
    guard = new JwtAuthGuard(
      reflector as any,
      jwtService as any,
      prisma as any,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when the session referenced by the token no longer exists', async () => {
    const { context, reflector } = buildContext({
      headers: { authorization: 'Bearer good' },
    });
    jwtService.verifyAsync.mockResolvedValue({ sub: 'u1', jti: 's1' });
    prisma.session.findUnique.mockResolvedValue(null);
    guard = new JwtAuthGuard(
      reflector as any,
      jwtService as any,
      prisma as any,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when the session belongs to a different user than the token claims', async () => {
    const { context, reflector } = buildContext({
      headers: { authorization: 'Bearer good' },
    });
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'someone-else',
      jti: 's1',
    });
    prisma.session.findUnique.mockResolvedValue(buildSession());
    guard = new JwtAuthGuard(
      reflector as any,
      jwtService as any,
      prisma as any,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a revoked session', async () => {
    const { context, reflector } = buildContext({
      headers: { authorization: 'Bearer good' },
    });
    jwtService.verifyAsync.mockResolvedValue({ sub: 'u1', jti: 's1' });
    prisma.session.findUnique.mockResolvedValue(
      buildSession({ revokedAt: new Date() }),
    );
    guard = new JwtAuthGuard(
      reflector as any,
      jwtService as any,
      prisma as any,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an expired session', async () => {
    const { context, reflector } = buildContext({
      headers: { authorization: 'Bearer good' },
    });
    jwtService.verifyAsync.mockResolvedValue({ sub: 'u1', jti: 's1' });
    prisma.session.findUnique.mockResolvedValue(
      buildSession({ expiresAt: pastDate() }),
    );
    guard = new JwtAuthGuard(
      reflector as any,
      jwtService as any,
      prisma as any,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an inactive user even with a valid, unexpired session', async () => {
    const { context, reflector } = buildContext({
      headers: { authorization: 'Bearer good' },
    });
    jwtService.verifyAsync.mockResolvedValue({ sub: 'u1', jti: 's1' });
    const session = buildSession();
    session.user.isActive = false;
    prisma.session.findUnique.mockResolvedValue(session);
    guard = new JwtAuthGuard(
      reflector as any,
      jwtService as any,
      prisma as any,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('attaches a flattened roles/permissions authContext on success', async () => {
    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer good' },
    };
    const { context, reflector } = buildContext(request);
    jwtService.verifyAsync.mockResolvedValue({ sub: 'u1', jti: 's1' });
    prisma.session.findUnique.mockResolvedValue(buildSession());
    guard = new JwtAuthGuard(
      reflector as any,
      jwtService as any,
      prisma as any,
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.authContext).toEqual({
      userId: 'u1',
      sessionId: 's1',
      email: 'a@example.com',
      roles: ['hr'],
      permissions: ['leave:approve', 'employee:manage'],
    });
  });
});
