import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AdminService } from './admin.service.js';
import type { AuthContext } from '../common/auth-context.js';

function buildPrismaMock() {
  return {
    companySettings: { findUnique: vi.fn(), update: vi.fn() },
    role: { findMany: vi.fn().mockResolvedValue([]) },
    employee: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn() },
  };
}

const actor: AuthContext = {
  userId: 'admin-1',
  sessionId: 's1',
  email: 'admin@example.com',
  roles: ['admin'],
  permissions: ['company:manage', 'user:manage'],
};

describe('AdminService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let usersService: {
    replaceRoles: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
  };
  let auditService: { log: ReturnType<typeof vi.fn> };
  let service: AdminService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    usersService = {
      replaceRoles: vi.fn().mockResolvedValue(undefined),
      findOne: vi.fn(),
    };
    auditService = { log: vi.fn().mockResolvedValue(undefined) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new AdminService(
      prisma as any,
      usersService as any,
      auditService as any,
    );
  });

  describe('getCompanySettings', () => {
    it('fails loudly rather than guessing when the singleton row is missing', async () => {
      prisma.companySettings.findUnique.mockResolvedValue(null);
      await expect(service.getCompanySettings()).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('returns the seeded row', async () => {
      prisma.companySettings.findUnique.mockResolvedValue({
        id: 'singleton',
        legalName: '1Solutions Pvt. Ltd.',
      });
      const result = await service.getCompanySettings();
      expect(result.legalName).toBe('1Solutions Pvt. Ltd.');
    });
  });

  describe('updateCompanySettings', () => {
    it('stamps updatedByUserId and logs SETTINGS_UPDATED', async () => {
      prisma.companySettings.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'singleton', ...data }),
      );

      await service.updateCompanySettings(
        {
          legalName: 'New Name',
          brandName: 'New',
          supportEmail: 'hr@example.com',
        },
        actor,
      );

      expect(prisma.companySettings.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ updatedByUserId: 'admin-1' }),
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'SETTINGS_UPDATED' }),
      );
    });
  });

  describe('getRolePermissions', () => {
    it('keys the result by role key', async () => {
      prisma.role.findMany.mockResolvedValue([
        {
          key: 'admin',
          rolePermissions: [
            { permission: { description: 'Manage everything' } },
          ],
        },
        { key: 'employee', rolePermissions: [] },
      ]);

      const result = await service.getRolePermissions();

      expect(result).toEqual({ admin: ['Manage everything'], employee: [] });
    });
  });

  describe('setEmployeeRole', () => {
    it('throws for an unknown employee', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      await expect(
        service.setEmployeeRole('missing', 'manager', actor),
      ).rejects.toThrow(NotFoundException);
    });

    it('delegates to UsersService.replaceRoles with a single-role array', async () => {
      prisma.employee.findUnique.mockResolvedValue({
        id: 'emp-1',
        userId: 'user-1',
        firstName: 'A',
        lastName: 'B',
        department: { name: 'Engineering' },
      });
      usersService.findOne.mockResolvedValue({
        email: 'a@example.com',
        roles: [{ key: 'manager', label: 'Manager' }],
      });

      const result = await service.setEmployeeRole('emp-1', 'manager', actor);

      expect(usersService.replaceRoles).toHaveBeenCalledWith(
        'user-1',
        ['manager'],
        actor,
      );
      expect(result).toEqual({
        employeeId: 'emp-1',
        userId: 'user-1',
        name: 'A B',
        email: 'a@example.com',
        department: 'Engineering',
        role: 'manager',
      });
    });
  });
});
