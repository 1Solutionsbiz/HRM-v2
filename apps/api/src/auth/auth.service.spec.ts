import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import type { AuthContext } from '../common/auth-context.js';

function buildPrismaMock() {
  return {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    device: {
      upsert: vi.fn(),
    },
    session: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
  };
}

function buildJwtMock() {
  return { signAsync: vi.fn().mockResolvedValue('signed.jwt.token') };
}

function buildPasswordServiceMock() {
  return {
    verify: vi.fn(),
    hash: vi.fn(),
    simulateVerification: vi.fn().mockResolvedValue(undefined),
  };
}

function buildAuditServiceMock() {
  return { log: vi.fn().mockResolvedValue(undefined) };
}

const meta = { ipAddress: '127.0.0.1', userAgent: 'vitest' };

describe('AuthService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let jwtService: ReturnType<typeof buildJwtMock>;
  let passwordService: ReturnType<typeof buildPasswordServiceMock>;
  let auditService: ReturnType<typeof buildAuditServiceMock>;
  let service: AuthService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    jwtService = buildJwtMock();
    passwordService = buildPasswordServiceMock();
    auditService = buildAuditServiceMock();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new AuthService(
      prisma as any,
      jwtService as any,
      passwordService as any,
      auditService as any,
    );
  });

  describe('login', () => {
    it('rejects an unknown email with a generic message and pays the same verification cost', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'x' }, meta),
      ).rejects.toThrow(UnauthorizedException);
      expect(passwordService.simulateVerification).toHaveBeenCalledOnce();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'LOGIN_FAILED',
          actorEmail: 'nobody@example.com',
        }),
      );
    });

    it('rejects a locked account without checking the password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@example.com',
        passwordHash: 'irrelevant',
        failedLoginCount: 5,
        lockedUntil: new Date(Date.now() + 60_000),
        isActive: true,
        employee: null,
      });

      await expect(
        service.login({ email: 'a@example.com', password: 'x' }, meta),
      ).rejects.toThrow(/temporarily locked/);
      expect(passwordService.verify).not.toHaveBeenCalled();
    });

    it('rejects an inactive account with the generic message', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@example.com',
        passwordHash: 'irrelevant',
        failedLoginCount: 0,
        lockedUntil: null,
        isActive: false,
        employee: null,
      });

      await expect(
        service.login({ email: 'a@example.com', password: 'x' }, meta),
      ).rejects.toThrow('Invalid email or password');
      expect(passwordService.simulateVerification).toHaveBeenCalledOnce();
    });

    it('increments failedLoginCount on a wrong password without locking below the threshold', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@example.com',
        passwordHash: 'stored-hash',
        failedLoginCount: 1,
        lockedUntil: null,
        isActive: true,
        employee: null,
      });
      passwordService.verify.mockResolvedValue(false);

      await expect(
        service.login({ email: 'a@example.com', password: 'wrong' }, meta),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { failedLoginCount: 2, lockedUntil: null },
      });
    });

    it('locks the account once failedLoginCount reaches the threshold', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@example.com',
        passwordHash: 'stored-hash',
        failedLoginCount: 4,
        lockedUntil: null,
        isActive: true,
        employee: null,
      });
      passwordService.verify.mockResolvedValue(false);

      await expect(
        service.login({ email: 'a@example.com', password: 'wrong' }, meta),
      ).rejects.toThrow(UnauthorizedException);
      const call = prisma.user.update.mock.calls[0][0];
      expect(call.data.failedLoginCount).toBe(0);
      expect(call.data.lockedUntil).toBeInstanceOf(Date);
    });

    it('issues a token pair and resets lockout counters on success', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@example.com',
        passwordHash: 'stored-hash',
        failedLoginCount: 2,
        lockedUntil: null,
        isActive: true,
        employee: { firstName: 'Aditi', lastName: 'Sharma' },
      });
      passwordService.verify.mockResolvedValue(true);
      prisma.session.create.mockResolvedValue({ id: 'session-1' });

      const result = await service.login(
        { email: 'a@example.com', password: 'correct' },
        meta,
      );

      expect(result).toEqual({
        accessToken: 'signed.jwt.token',
        refreshToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: 15 * 60,
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: 'u1',
        jti: 'session-1',
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: {
          failedLoginCount: 0,
          lockedUntil: null,
          lastLoginAt: expect.any(Date),
        },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'LOGIN_SUCCESS',
          actorName: 'Aditi Sharma',
        }),
      );
    });
  });

  describe('refresh', () => {
    it('rejects a revoked or expired session', async () => {
      prisma.session.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
        deviceId: null,
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        user: { isActive: true },
      });

      await expect(
        service.refresh({ refreshToken: 'tok' }, meta),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rotates: revokes the old session and issues a new one', async () => {
      prisma.session.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
        deviceId: 'd1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        user: { isActive: true },
      });
      prisma.session.create.mockResolvedValue({ id: 's2' });

      const result = await service.refresh({ refreshToken: 'tok' }, meta);

      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { revokedAt: expect.any(Date), revokedReason: 'ROTATED' },
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: 'u1',
        jti: 's2',
      });
      expect(result.accessToken).toBe('signed.jwt.token');
    });
  });

  describe('logout', () => {
    it('revokes only the current session', async () => {
      const authContext: AuthContext = {
        userId: 'u1',
        sessionId: 's1',
        email: 'a@example.com',
        roles: [],
        permissions: [],
      };

      await service.logout(authContext, meta);

      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { id: 's1', revokedAt: null },
        data: { revokedAt: expect.any(Date), revokedReason: 'LOGOUT' },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'LOGOUT' }),
      );
    });
  });

  describe('changePassword', () => {
    const authContext: AuthContext = {
      userId: 'u1',
      sessionId: 's1',
      email: 'a@example.com',
      roles: [],
      permissions: [],
    };

    it('rejects an incorrect current password', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        id: 'u1',
        email: 'a@example.com',
        passwordHash: 'h',
      });
      passwordService.verify.mockResolvedValue(false);

      await expect(
        service.changePassword(
          authContext,
          { currentPassword: 'wrong', newPassword: 'x'.repeat(12) },
          meta,
        ),
      ).rejects.toThrow('Current password is incorrect');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('updates the hash and revokes every other session', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        id: 'u1',
        email: 'a@example.com',
        passwordHash: 'h',
      });
      passwordService.verify.mockResolvedValue(true);
      passwordService.hash.mockResolvedValue('new-hash');

      await service.changePassword(
        authContext,
        { currentPassword: 'old', newPassword: 'x'.repeat(12) },
        meta,
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { passwordHash: 'new-hash', passwordUpdatedAt: expect.any(Date) },
      });
      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', id: { not: 's1' }, revokedAt: null },
        data: {
          revokedAt: expect.any(Date),
          revokedReason: 'PASSWORD_CHANGED',
        },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'PASSWORD_CHANGED' }),
      );
    });
  });
});
