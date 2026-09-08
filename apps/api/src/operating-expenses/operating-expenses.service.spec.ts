import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OperatingExpensesService } from './operating-expenses.service.js';
import type { AuthContext } from '../common/auth-context.js';

function decimal(value: number) {
  return { toNumber: () => value };
}

function buildPrismaMock() {
  return {
    operatingExpense: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn(),
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
    it('zero-fills every category not yet entered for the period', async () => {
      prisma.operatingExpense.findMany.mockResolvedValue([
        { category: 'RENT', amount: decimal(47000), note: null, updatedAt: new Date('2026-09-01') },
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
      expect(result.total).toBe(47000);
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
    it('upserts on the category+period unique key and audit-logs the change', async () => {
      prisma.operatingExpense.upsert.mockResolvedValue({
        id: 'oe-1',
        category: 'ELECTRICITY',
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
          category_periodMonth_periodYear: {
            category: 'ELECTRICITY',
            periodMonth: 9,
            periodYear: 2026,
          },
        },
        create: {
          category: 'ELECTRICITY',
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
  });
});
