import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import type { AuthContext } from '../common/auth-context.js';

function buildPrismaMock() {
  return {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    userRole: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    role: {
      findMany: vi.fn(),
    },
    session: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

const actor: AuthContext = {
  userId: 'admin-1',
  sessionId: 's1',
  email: 'admin@example.com',
  roles: ['admin'],
  permissions: ['user:manage'],
};

describe('UsersService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let passwordService: { hash: ReturnType<typeof vi.fn> };
  let auditService: { log: ReturnType<typeof vi.fn> };
  let service: UsersService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    passwordService = { hash: vi.fn().mockResolvedValue('hashed') };
    auditService = { log: vi.fn().mockResolvedValue(undefined) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new UsersService(
      prisma as any,
      passwordService as any,
      auditService as any,
    );
  });

  describe('create', () => {
    it('rejects an email already in use', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });

      await expect(
        service.create({ email: 'taken@example.com' }, actor),
      ).rejects.toThrow(ConflictException);
    });

    it('defaults to the employee role when none is given', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findMany.mockResolvedValue([{ id: 'r1', key: 'employee' }]);
      prisma.user.create.mockResolvedValue({
        id: 'u1',
        email: 'new@example.com',
      });

      const result = await service.create({ email: 'new@example.com' }, actor);

      expect(prisma.role.findMany).toHaveBeenCalledWith({
        where: { key: { in: ['employee'] } },
      });
      expect(result.roles).toEqual(['employee']);
      expect(typeof result.temporaryPassword).toBe('string');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'USER_CREATED' }),
      );
    });

    it('rejects an unknown role key', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findMany.mockResolvedValue([]);

      await expect(
        service.create(
          { email: 'new@example.com', roleKeys: ['made-up'] },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('setActiveStatus', () => {
    it('throws for an unknown user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.setActiveStatus('missing', false, actor),
      ).rejects.toThrow(NotFoundException);
    });

    it('revokes active sessions when deactivating', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u1',
        email: 'a@example.com',
      });
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u1',
        email: 'a@example.com',
        isActive: false,
        lastLoginAt: null,
        createdAt: new Date(),
        userRoles: [],
      });

      await service.setActiveStatus('u1', false, actor);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { isActive: false },
      });
      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', revokedAt: null },
        data: {
          revokedAt: expect.any(Date),
          revokedReason: 'ACCOUNT_DEACTIVATED',
        },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'USER_STATUS_CHANGED' }),
      );
    });

    it('does not revoke sessions when reactivating', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u1',
        email: 'a@example.com',
      });
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u1',
        email: 'a@example.com',
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
        userRoles: [],
      });

      await service.setActiveStatus('u1', true, actor);

      expect(prisma.session.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('replaceRoles', () => {
    it('replaces the full role set', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u1',
        email: 'a@example.com',
      });
      prisma.role.findMany.mockResolvedValue([{ id: 'r1', key: 'hr' }]);
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u1',
        email: 'a@example.com',
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
        userRoles: [{ role: { key: 'hr', label: 'HR' } }],
      });

      const result = await service.replaceRoles('u1', ['hr'], actor);

      expect(prisma.userRole.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
      });
      expect(prisma.userRole.createMany).toHaveBeenCalledWith({
        data: [{ userId: 'u1', roleId: 'r1', assignedByUserId: 'admin-1' }],
      });
      expect(result.roles).toEqual([{ key: 'hr', label: 'HR' }]);
    });

    it('allows revoking every role with an empty array', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u1',
        email: 'a@example.com',
      });
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u1',
        email: 'a@example.com',
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
        userRoles: [],
      });

      await service.replaceRoles('u1', [], actor);

      expect(prisma.userRole.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
      });
      expect(prisma.userRole.createMany).not.toHaveBeenCalled();
      expect(prisma.role.findMany).not.toHaveBeenCalled();
    });
  });
});
