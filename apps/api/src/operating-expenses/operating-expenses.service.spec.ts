import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OperatingExpensesService } from './operating-expenses.service.js';
import type { AuthContext } from '../common/auth-context.js';

function decimal(value: number) {
  return { toNumber: () => value };
}

function buildPrismaMock() {
  return {
    operatingExpense: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  };
}

const actor: AuthContext = {
  userId: 'hr-1',
  sessionId: 's1',
  email: 'hr@example.com',
  roles: ['hr'],
  permissions: ['payroll:manage'],
};

describe('OperatingExpensesService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let auditService: { log: ReturnType<typeof vi.fn> };
  let service: OperatingExpensesService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    auditService = { log: vi.fn().mockResolvedValue(undefined) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new OperatingExpensesService(prisma as any, auditService as any);
  });

  describe('getForPeriod', () => {
    it('zero-fills every standard category not yet entered, and lists CUSTOM rows separately', async () => {
      prisma.operatingExpense.findMany.mockResolvedValue([
        { category: 'RENT', label: '', amount: decimal(47000), note: null, updatedAt: new Date('2026-09-01') },
        { id: 'oe-custom-1', category: 'CUSTOM', label: 'Team lunch', amount: decimal(2500), note: null, updatedAt: new Date('2026-09-02') },
      ]);

      const result = await service.getForPeriod(9, 2026);

      expect(result.periodMonth).toBe(9);
      expect(result.periodYear).toBe(2026);
      expect(result.entries).toEqual([
        { category: 'RENT', amount: 47000, note: null, updatedAt: new Date('2026-09-01') },
        { category: 'ELECTRICITY', amount: 0, note: null, updatedAt: null },
        { category: 'INTERNET', amount: 0, note: null, updatedAt: null },
        { category: 'MISCELLANEOUS', amount: 0, note: null, updatedAt: null },
      ]);
      expect(result.custom).toEqual([
        { id: 'oe-custom-1', label: 'Team lunch', amount: 2500, note: null, updatedAt: new Date('2026-09-02') },
      ]);
      expect(result.total).toBe(49500);
    });

    it('defaults to the current month/year when none is given', async () => {
      const now = new Date();
      await service.getForPeriod();
      expect(prisma.operatingExpense.findMany).toHaveBeenCalledWith({
        where: {
          periodMonth: now.getUTCMonth() + 1,
          periodYear: now.getUTCFullYear(),
        },
      });
    });
  });

  describe('upsert', () => {
    it('upserts a standard category on an empty label regardless of what was sent', async () => {
      prisma.operatingExpense.upsert.mockResolvedValue({
        id: 'oe-1',
        category: 'ELECTRICITY',
        label: '',
        periodMonth: 9,
        periodYear: 2026,
        amount: decimal(4200),
        note: null,
      });

      const result = await service.upsert(
        { category: 'ELECTRICITY', periodMonth: 9, periodYear: 2026, amount: 4200 },
        actor,
      );

      expect(prisma.operatingExpense.upsert).toHaveBeenCalledWith({
        where: {
          category_label_periodMonth_periodYear: {
            category: 'ELECTRICITY',
            label: '',
            periodMonth: 9,
            periodYear: 2026,
          },
        },
        create: {
          category: 'ELECTRICITY',
          label: '',
          periodMonth: 9,
          periodYear: 2026,
          amount: 4200,
          note: null,
        },
        update: { amount: 4200, note: null },
      });
      expect(auditService.log).toHaveBeenCalled();
      expect(result.amount).toBe(4200);
    });

    it('upserts a CUSTOM row keyed on its trimmed label', async () => {
      prisma.operatingExpense.upsert.mockResolvedValue({
        id: 'oe-2',
        category: 'CUSTOM',
        label: 'Team lunch',
        periodMonth: 9,
        periodYear: 2026,
        amount: decimal(2500),
        note: null,
      });

      await service.upsert(
        { category: 'CUSTOM', label: '  Team lunch  ', periodMonth: 9, periodYear: 2026, amount: 2500 },
        actor,
      );

      expect(prisma.operatingExpense.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            category_label_periodMonth_periodYear: {
              category: 'CUSTOM',
              label: 'Team lunch',
              periodMonth: 9,
              periodYear: 2026,
            },
          },
        }),
      );
    });
  });

  describe('remove', () => {
    it('deletes a CUSTOM entry and audit-logs it', async () => {
      prisma.operatingExpense.findUnique.mockResolvedValue({
        id: 'oe-2',
        category: 'CUSTOM',
        label: 'Team lunch',
        periodMonth: 9,
        periodYear: 2026,
      });

      await service.remove('oe-2', actor);

      expect(prisma.operatingExpense.delete).toHaveBeenCalledWith({ where: { id: 'oe-2' } });
      expect(auditService.log).toHaveBeenCalled();
    });

    it('refuses to delete a standard category row', async () => {
      prisma.operatingExpense.findUnique.mockResolvedValue({
        id: 'oe-1',
        category: 'RENT',
        label: '',
      });
      await expect(service.remove('oe-1', actor)).rejects.toThrow(BadRequestException);
    });

    it('throws when the entry does not exist', async () => {
      prisma.operatingExpense.findUnique.mockResolvedValue(null);
      await expect(service.remove('missing', actor)).rejects.toThrow(NotFoundException);
    });
  });
});
