import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EmployeeOfTheMonthService } from './employee-of-the-month.service.js';
import type { AuthContext } from '../common/auth-context.js';

function buildPrismaMock() {
  return {
    employee: { findUnique: vi.fn() },
    employeeOfTheMonth: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  };
}

const actor: AuthContext = {
  userId: 'admin-1',
  sessionId: 's1',
  email: 'admin@example.com',
  roles: ['admin'],
  permissions: ['recognition:manage'],
};

describe('EmployeeOfTheMonthService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let auditService: { log: ReturnType<typeof vi.fn> };
  let service: EmployeeOfTheMonthService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    auditService = { log: vi.fn().mockResolvedValue(undefined) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new EmployeeOfTheMonthService(prisma as any, auditService as any);
  });

  describe('getCurrent', () => {
    it('queries by the current calendar month/year', async () => {
      await service.getCurrent();
      const now = new Date();
      expect(prisma.employeeOfTheMonth.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            periodMonth_periodYear: {
              periodMonth: now.getUTCMonth() + 1,
              periodYear: now.getUTCFullYear(),
            },
          },
        }),
      );
    });

    it('returns null when nobody has been nominated this month', async () => {
      prisma.employeeOfTheMonth.findUnique.mockResolvedValue(null);
      const result = await service.getCurrent();
      expect(result).toBeNull();
    });
  });

  describe('nominate', () => {
    it('throws when the employee does not exist', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      await expect(
        service.nominate({ employeeId: 'missing' }, actor),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.employeeOfTheMonth.upsert).not.toHaveBeenCalled();
    });

    it('refuses to nominate an inactive employee', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1', status: 'INACTIVE' });
      await expect(
        service.nominate({ employeeId: 'emp-1' }, actor),
      ).rejects.toThrow(BadRequestException);
    });

    it('defaults to the current month/year and upserts on that key', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1', status: 'ACTIVE' });
      prisma.employeeOfTheMonth.upsert.mockResolvedValue({
        id: 'award-1',
        employee: { firstName: 'Sonu', lastName: 'Yadav' },
      });

      const now = new Date();
      await service.nominate({ employeeId: 'emp-1', note: 'Great work' }, actor);

      expect(prisma.employeeOfTheMonth.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            periodMonth_periodYear: {
              periodMonth: now.getUTCMonth() + 1,
              periodYear: now.getUTCFullYear(),
            },
          },
          create: expect.objectContaining({ employeeId: 'emp-1', note: 'Great work' }),
          update: expect.objectContaining({ employeeId: 'emp-1', note: 'Great work' }),
        }),
      );
      expect(auditService.log).toHaveBeenCalled();
    });

    it('honors an explicit periodMonth/periodYear when given', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1', status: 'ACTIVE' });
      prisma.employeeOfTheMonth.upsert.mockResolvedValue({
        id: 'award-1',
        employee: { firstName: 'Sonu', lastName: 'Yadav' },
      });

      await service.nominate({ employeeId: 'emp-1', periodMonth: 3, periodYear: 2027 }, actor);

      expect(prisma.employeeOfTheMonth.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { periodMonth_periodYear: { periodMonth: 3, periodYear: 2027 } },
        }),
      );
    });
  });
});
