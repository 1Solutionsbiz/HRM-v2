import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PayrollService } from './payroll.service.js';
import type { AuthContext } from '../common/auth-context.js';

function decimal(value: number) {
  return { toNumber: () => value };
}

function buildPrismaMock() {
  const prisma = {
    employee: { findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    department: { findMany: vi.fn().mockResolvedValue([]) },
    salaryStructure: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
    },
    salaryRevision: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    },
    payslip: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
    },
    payslipLineItem: { create: vi.fn().mockResolvedValue(undefined) },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(prisma),
    ),
  };
  return prisma;
}

const actor: AuthContext = {
  userId: 'hr-1',
  sessionId: 's1',
  email: 'hr@example.com',
  roles: ['hr'],
  permissions: ['payroll:manage'],
};

describe('PayrollService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let auditService: { log: ReturnType<typeof vi.fn> };
  let sequenceService: { next: ReturnType<typeof vi.fn> };
  let service: PayrollService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
    auditService = { log: vi.fn().mockResolvedValue(undefined) };
    sequenceService = { next: vi.fn().mockResolvedValue(1) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new PayrollService(
      prisma as any,
      auditService as any,
      sequenceService as any,
    );
  });

  describe('reviseSalary', () => {
    it('throws for an unknown employee', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      await expect(
        service.reviseSalary(
          'missing',
          { newAmount: 50000, effectiveDate: '2026-09-01' },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a future effectiveDate — revisions take effect immediately, nothing schedules a later one', async () => {
      await expect(
        service.reviseSalary(
          'emp-1',
          { newAmount: 50000, effectiveDate: '2099-01-01' },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('records previousAmount as null when no structure exists yet', async () => {
      prisma.salaryStructure.findUnique.mockResolvedValue(null);
      prisma.salaryStructure.create.mockResolvedValue({
        id: 'ss-1',
        employeeId: 'emp-1',
        currentAmount: decimal(50000),
        status: 'ACTIVE',
        lastRevisedAt: new Date('2026-09-01'),
      });
      prisma.salaryRevision.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'sr-1',
          ...data,
          newAmount: decimal(data.newAmount),
        }),
      );

      const result = await service.reviseSalary(
        'emp-1',
        { newAmount: 50000, effectiveDate: '2026-09-01' },
        actor,
      );

      expect(prisma.salaryStructure.create).toHaveBeenCalled();
      expect(prisma.salaryRevision.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ previousAmount: null }),
        }),
      );
      expect(result.revision.previousAmount).toBeNull();
      expect(result.structure.currentAmount).toBe(50000);
    });

    it('captures previousAmount from the existing structure before updating', async () => {
      prisma.salaryStructure.findUnique.mockResolvedValue({
        id: 'ss-1',
        employeeId: 'emp-1',
        currentAmount: decimal(40000),
        status: 'ACTIVE',
        lastRevisedAt: null,
      });
      prisma.salaryStructure.update.mockResolvedValue({
        id: 'ss-1',
        employeeId: 'emp-1',
        currentAmount: decimal(45000),
        status: 'ACTIVE',
        lastRevisedAt: new Date('2026-09-01'),
      });
      prisma.salaryRevision.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'sr-1',
          ...data,
          previousAmount: decimal(data.previousAmount),
          newAmount: decimal(data.newAmount),
        }),
      );

      const result = await service.reviseSalary(
        'emp-1',
        { newAmount: 45000, effectiveDate: '2026-09-01' },
        actor,
      );

      expect(prisma.salaryRevision.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            previousAmount: 40000,
            newAmount: 45000,
          }),
        }),
      );
      expect(result.revision.previousAmount).toBe(40000);
    });
  });

  describe('generatePayslip', () => {
    const dto = {
      periodMonth: 9,
      periodYear: 2026,
      lineItems: [
        { type: 'EARNING' as const, label: 'Basic', amount: 40000 },
        { type: 'EARNING' as const, label: 'HRA', amount: 16000 },
        { type: 'DEDUCTION' as const, label: 'PF', amount: 4800 },
        { type: 'DEDUCTION' as const, label: 'Tax', amount: 3200 },
      ],
    };

    it('rejects a second payslip for the same employee and period', async () => {
      prisma.payslip.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(
        service.generatePayslip('emp-1', dto, actor),
      ).rejects.toThrow(ConflictException);
    });

    it('computes grossAmount as the sum of EARNING lines and netAmount after DEDUCTION lines', async () => {
      prisma.payslip.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'payslip-1',
          ...data,
          grossAmount: decimal(data.grossAmount),
          netAmount: decimal(data.netAmount),
        }),
      );
      prisma.payslip.findUniqueOrThrow.mockImplementation(() =>
        Promise.resolve({
          id: 'payslip-1',
          payslipNumber: 'PS-2026-00001',
          employeeId: 'emp-1',
          periodMonth: 9,
          periodYear: 2026,
          grossAmount: decimal(56000),
          netAmount: decimal(48000),
          status: 'PROCESSING',
          paidAt: null,
          lineItems: dto.lineItems.map((item, i) => ({
            ...item,
            id: `li-${i}`,
            amount: decimal(item.amount),
          })),
        }),
      );

      const result = await service.generatePayslip('emp-1', dto, actor);

      expect(result.grossAmount).toBe(56000);
      expect(result.netAmount).toBe(48000);
      expect(typeof result.grossAmount).toBe('number');
      expect(typeof result.netAmount).toBe('number');
      expect(prisma.payslipLineItem.create).toHaveBeenCalledTimes(4);
    });

    it('mints the payslip number from the sequence counter, prefixed by the period year', async () => {
      sequenceService.next.mockResolvedValue(7);
      prisma.payslip.create.mockImplementation(({ data }) =>
        Promise.resolve({
          ...data,
          id: 'payslip-1',
          grossAmount: decimal(data.grossAmount),
          netAmount: decimal(data.netAmount),
        }),
      );
      prisma.payslip.findUniqueOrThrow.mockResolvedValue({
        id: 'payslip-1',
        employeeId: 'emp-1',
        grossAmount: decimal(56000),
        netAmount: decimal(48000),
        lineItems: [],
      });

      await service.generatePayslip('emp-1', dto, actor);

      expect(prisma.payslip.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ payslipNumber: 'PS-2026-00007' }),
        }),
      );
    });
  });

  describe('markPayslipPaid', () => {
    it('throws for an unknown payslip', async () => {
      prisma.payslip.findUnique.mockResolvedValue(null);
      await expect(service.markPayslipPaid('missing', actor)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects re-marking an already-paid payslip', async () => {
      prisma.payslip.findUnique.mockResolvedValue({
        id: 'p1',
        employeeId: 'emp-1',
        status: 'PAID',
        lineItems: [],
      });
      await expect(service.markPayslipPaid('p1', actor)).rejects.toThrow(
        ConflictException,
      );
    });

    it('sets status to PAID and stamps paidAt', async () => {
      prisma.payslip.findUnique.mockResolvedValue({
        id: 'p1',
        employeeId: 'emp-1',
        payslipNumber: 'PS-2026-00001',
        status: 'PROCESSING',
        lineItems: [],
      });
      prisma.payslip.update.mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'p1',
          employeeId: 'emp-1',
          grossAmount: decimal(1000),
          netAmount: decimal(900),
          lineItems: [],
          ...data,
        }),
      );

      const result = await service.markPayslipPaid('p1', actor);

      expect(result.status).toBe('PAID');
      expect(result.paidAt).toBeInstanceOf(Date);
    });
  });

  describe('getMyPayslip', () => {
    it('throws NotFoundException (not ForbiddenException) for a payslip owned by someone else', async () => {
      prisma.payslip.findUnique.mockResolvedValue({
        id: 'p1',
        employeeId: 'someone-else',
        grossAmount: decimal(1000),
        netAmount: decimal(900),
        lineItems: [],
      });
      await expect(service.getMyPayslip('user-1', 'p1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getTrend', () => {
    it('groups gross cost by period and counts distinct employees with a payslip that period', async () => {
      prisma.payslip.findMany.mockResolvedValue([
        {
          periodMonth: 9,
          periodYear: 2026,
          grossAmount: decimal(1000),
          employeeId: 'emp-1',
        },
        {
          periodMonth: 9,
          periodYear: 2026,
          grossAmount: decimal(2000),
          employeeId: 'emp-2',
        },
        {
          periodMonth: 8,
          periodYear: 2026,
          grossAmount: decimal(500),
          employeeId: 'emp-1',
        },
      ]);

      const result = await service.getTrend();

      expect(result).toEqual([
        {
          periodMonth: 8,
          periodYear: 2026,
          cost: 500,
          payslipCount: 1,
          activeHeadcount: 0,
        },
        {
          periodMonth: 9,
          periodYear: 2026,
          cost: 3000,
          payslipCount: 2,
          activeHeadcount: 0,
        },
      ]);
    });

    it('counts activeHeadcount as ACTIVE employees who had joined by the period end, excluding INACTIVE ones', async () => {
      prisma.payslip.findMany.mockResolvedValue([
        {
          periodMonth: 9,
          periodYear: 2026,
          grossAmount: decimal(1000),
          employeeId: 'emp-1',
        },
      ]);
      prisma.employee.findMany.mockResolvedValue([
        {
          id: 'emp-1',
          status: 'ACTIVE',
          dateOfJoining: new Date('2026-01-01'),
        },
        {
          id: 'emp-2',
          status: 'ACTIVE',
          dateOfJoining: new Date('2026-01-01'),
        },
        {
          id: 'emp-3',
          status: 'ACTIVE',
          dateOfJoining: new Date('2099-01-01'),
        },
        {
          id: 'emp-4',
          status: 'INACTIVE',
          dateOfJoining: new Date('2026-01-01'),
        },
      ]);

      const [result] = await service.getTrend();

      expect(result.activeHeadcount).toBe(2);
    });

    it('returns only the trailing `months` periods', async () => {
      prisma.payslip.findMany.mockResolvedValue(
        Array.from({ length: 8 }, (_, i) => ({
          periodMonth: i + 1,
          periodYear: 2026,
          grossAmount: decimal(100),
          employeeId: 'emp-1',
        })),
      );

      const result = await service.getTrend(6);

      expect(result).toHaveLength(6);
      expect(result[0].periodMonth).toBe(3);
      expect(result.at(-1)!.periodMonth).toBe(8);
    });
  });

  describe('getByDepartment', () => {
    it('joins the department name and falls back to the latest period when none is given', async () => {
      prisma.payslip.findFirst.mockResolvedValue({
        periodMonth: 9,
        periodYear: 2026,
      });
      prisma.payslip.findMany.mockResolvedValue([
        {
          employeeId: 'emp-1',
          grossAmount: decimal(1000),
          employee: { departmentId: 'dept-1' },
        },
        {
          employeeId: 'emp-2',
          grossAmount: decimal(500),
          employee: { departmentId: null },
        },
      ]);
      prisma.department.findMany.mockResolvedValue([
        { id: 'dept-1', name: 'Engineering' },
      ]);

      const result = await service.getByDepartment();

      expect(result).toEqual(
        expect.arrayContaining([
          {
            departmentId: 'dept-1',
            departmentName: 'Engineering',
            cost: 1000,
            employeeCount: 1,
          },
          {
            departmentId: null,
            departmentName: null,
            cost: 500,
            employeeCount: 1,
          },
        ]),
      );
    });

    it('returns an empty array when no payslip has ever been generated', async () => {
      prisma.payslip.findFirst.mockResolvedValue(null);
      const result = await service.getByDepartment();
      expect(result).toEqual([]);
    });
  });
});
