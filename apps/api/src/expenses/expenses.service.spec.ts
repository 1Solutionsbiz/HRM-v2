import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service.js';
import type { AuthContext } from '../common/auth-context.js';

function decimal(value: number) {
  return { toNumber: () => value };
}

function buildPrismaMock() {
  return {
    employee: { findUnique: vi.fn() },
    expenseCategory: { findMany: vi.fn(), findUnique: vi.fn() },
    expenseClaim: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

const actor: AuthContext = {
  userId: 'hr-1',
  sessionId: 's1',
  email: 'hr@example.com',
  roles: ['hr'],
  permissions: ['expense:approve'],
};

describe('ExpensesService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let sequenceService: { next: ReturnType<typeof vi.fn> };
  let auditService: { log: ReturnType<typeof vi.fn> };
  let service: ExpensesService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
    sequenceService = { next: vi.fn().mockResolvedValue(7) };
    auditService = { log: vi.fn().mockResolvedValue(undefined) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new ExpensesService(
      prisma as any,
      auditService as any,
      sequenceService as any,
    );
  });

  describe('submitClaim', () => {
    const dto = {
      categoryId: 'cat-1',
      amount: 1000,
      expenseDate: '2026-09-05',
      description: 'Cab fare',
    };

    it('rejects an inactive or unknown category', async () => {
      prisma.expenseCategory.findUnique.mockResolvedValue(null);
      await expect(service.submitClaim('user-1', dto, actor)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('skips the cap check entirely when the category has no cap', async () => {
      prisma.expenseCategory.findUnique.mockResolvedValue({
        id: 'cat-1',
        isActive: true,
        monthlyCapAmount: null,
      });
      prisma.expenseClaim.create.mockResolvedValue({
        id: 'ex-1',
        code: 'EX-0007',
        amount: decimal(1000),
      });

      const result = await service.submitClaim('user-1', dto, actor);

      expect(prisma.expenseClaim.findMany).not.toHaveBeenCalled();
      expect(result.code).toBe('EX-0007');
      expect(result.amount).toBe(1000);
    });

    it('rejects a claim that would exceed the monthly cap', async () => {
      prisma.expenseCategory.findUnique.mockResolvedValue({
        id: 'cat-1',
        isActive: true,
        monthlyCapAmount: decimal(5000),
      });
      prisma.expenseClaim.findMany.mockResolvedValue([
        { amount: decimal(4500) },
      ]);

      await expect(
        service.submitClaim('user-1', { ...dto, amount: 1000 }, actor),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows a claim within the monthly cap', async () => {
      prisma.expenseCategory.findUnique.mockResolvedValue({
        id: 'cat-1',
        isActive: true,
        monthlyCapAmount: decimal(5000),
      });
      prisma.expenseClaim.findMany.mockResolvedValue([
        { amount: decimal(3000) },
      ]);
      prisma.expenseClaim.create.mockResolvedValue({
        id: 'ex-1',
        code: 'EX-0007',
        amount: decimal(1000),
      });

      await service.submitClaim('user-1', { ...dto, amount: 1000 }, actor);

      expect(prisma.expenseClaim.create).toHaveBeenCalled();
    });
  });

  describe('cancelMyClaim', () => {
    it('throws for a claim owned by someone else', async () => {
      prisma.expenseClaim.findUnique.mockResolvedValue({
        id: 'ex-1',
        employeeId: 'someone-else',
        status: 'PENDING',
        amount: decimal(100),
      });
      await expect(
        service.cancelMyClaim('user-1', 'ex-1', actor),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects cancelling an already-decided claim', async () => {
      prisma.expenseClaim.findUnique.mockResolvedValue({
        id: 'ex-1',
        employeeId: 'emp-1',
        status: 'APPROVED',
        amount: decimal(100),
      });
      await expect(
        service.cancelMyClaim('user-1', 'ex-1', actor),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('decide', () => {
    it('throws for an unknown claim', async () => {
      prisma.expenseClaim.findUnique.mockResolvedValue(null);
      await expect(
        service.decide('missing', { decision: 'APPROVED' }, actor),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects deciding an already-decided claim', async () => {
      prisma.expenseClaim.findUnique.mockResolvedValue({
        id: 'ex-1',
        status: 'APPROVED',
        amount: decimal(100),
        code: 'EX-0001',
      });
      await expect(
        service.decide('ex-1', { decision: 'APPROVED' }, actor),
      ).rejects.toThrow(ConflictException);
    });

    it('approves a pending claim', async () => {
      prisma.expenseClaim.findUnique.mockResolvedValue({
        id: 'ex-1',
        status: 'PENDING',
        amount: decimal(100),
        code: 'EX-0001',
      });
      prisma.expenseClaim.update.mockResolvedValue({
        status: 'APPROVED',
        amount: decimal(100),
      });

      const result = await service.decide(
        'ex-1',
        { decision: 'APPROVED' },
        actor,
      );

      expect(prisma.expenseClaim.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'APPROVED',
            approverUserId: 'hr-1',
          }),
        }),
      );
      expect(result.status).toBe('APPROVED');
    });
  });
});
