import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { LeaveService } from './leave.service.js';
import type { AuthContext } from '../common/auth-context.js';

function decimal(value: number) {
  return { toNumber: () => value };
}

function buildPrismaMock() {
  return {
    employee: { findUnique: vi.fn() },
    leaveType: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    leaveBalance: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    leaveRequest: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    attendanceDay: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

const actor: AuthContext = {
  userId: 'user-1',
  sessionId: 's1',
  email: 'a@example.com',
  roles: ['employee'],
  permissions: [],
};

describe('LeaveService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let sequenceService: { next: ReturnType<typeof vi.fn> };
  let auditService: { log: ReturnType<typeof vi.fn> };
  let service: LeaveService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
    sequenceService = { next: vi.fn().mockResolvedValue(42) };
    auditService = { log: vi.fn().mockResolvedValue(undefined) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new LeaveService(
      prisma as any,
      auditService as any,
      sequenceService as any,
    );
  });

  describe('getBalancesForUser', () => {
    it('synthesizes a balance from LeaveType.defaultAnnualDays when no row exists', async () => {
      prisma.leaveType.findMany.mockResolvedValue([
        {
          id: 'lt-1',
          key: 'casual',
          name: 'Casual Leave',
          defaultAnnualDays: decimal(12),
        },
      ]);
      prisma.leaveBalance.findMany.mockResolvedValue([]);

      const result = await service.getBalancesForUser('user-1');

      expect(result).toEqual([
        {
          leaveTypeId: 'lt-1',
          leaveTypeKey: 'casual',
          leaveTypeName: 'Casual Leave',
          year: new Date().getFullYear(),
          allocatedDays: 12,
          carriedOverDays: 0,
          usedDays: 0,
          remainingDays: 12,
        },
      ]);
    });

    it('uses a real LeaveBalance row when one exists', async () => {
      prisma.leaveType.findMany.mockResolvedValue([
        {
          id: 'lt-1',
          key: 'casual',
          name: 'Casual Leave',
          defaultAnnualDays: decimal(12),
        },
      ]);
      prisma.leaveBalance.findMany.mockResolvedValue([
        {
          leaveTypeId: 'lt-1',
          allocatedDays: decimal(12),
          carriedOverDays: decimal(2),
          usedDays: decimal(4),
        },
      ]);

      const result = await service.getBalancesForUser('user-1');
      expect(result[0]).toMatchObject({
        allocatedDays: 12,
        carriedOverDays: 2,
        usedDays: 4,
        remainingDays: 10,
      });
    });
  });

  describe('applyLeave', () => {
    const dto = {
      leaveTypeId: 'lt-1',
      startDate: '2026-09-14',
      endDate: '2026-09-14',
      reason: 'Family function',
    };

    beforeEach(() => {
      prisma.leaveType.findUnique.mockResolvedValue({
        id: 'lt-1',
        isActive: true,
        defaultAnnualDays: decimal(12),
      });
    });

    it('rejects an inactive or unknown leave type', async () => {
      prisma.leaveType.findUnique.mockResolvedValue(null);
      await expect(service.applyLeave('user-1', dto, actor)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects startDate after endDate', async () => {
      await expect(
        service.applyLeave(
          'user-1',
          { ...dto, startDate: '2026-09-20', endDate: '2026-09-10' },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a half-day request spanning more than one date', async () => {
      await expect(
        service.applyLeave(
          'user-1',
          { ...dto, dayType: 'HALF_DAY', endDate: '2026-09-15' },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects overlapping an existing pending/approved request', async () => {
      prisma.leaveRequest.findFirst.mockResolvedValue({
        id: 'lr-existing',
        status: 'PENDING',
      });
      await expect(service.applyLeave('user-1', dto, actor)).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects a request that would exceed the available balance', async () => {
      prisma.leaveBalance.findUnique.mockResolvedValue(null);
      prisma.leaveRequest.findMany.mockResolvedValue([
        { totalDays: decimal(12) },
      ]); // already fully committed
      await expect(service.applyLeave('user-1', dto, actor)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates a request with a generated code on success', async () => {
      prisma.leaveBalance.findUnique.mockResolvedValue(null);
      prisma.leaveRequest.create.mockResolvedValue({
        id: 'lr-1',
        code: 'LV-0042',
        totalDays: decimal(1),
      });

      const result = await service.applyLeave('user-1', dto, actor);

      expect(sequenceService.next).toHaveBeenCalledWith('leaveRequestCode');
      expect(prisma.leaveRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ code: 'LV-0042', totalDays: 1 }),
        }),
      );
      expect(result.code).toBe('LV-0042');
    });
  });

  describe('cancelMyRequest', () => {
    it('throws for a request owned by someone else', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'lr-1',
        employeeId: 'someone-else',
        status: 'PENDING',
      });
      await expect(
        service.cancelMyRequest('user-1', 'lr-1', actor),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects cancelling an already-decided request', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'lr-1',
        employeeId: 'emp-1',
        status: 'APPROVED',
      });
      await expect(
        service.cancelMyRequest('user-1', 'lr-1', actor),
      ).rejects.toThrow(ConflictException);
    });

    it('cancels a pending request owned by the caller', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'lr-1',
        employeeId: 'emp-1',
        status: 'PENDING',
      });
      prisma.leaveRequest.update.mockResolvedValue({
        id: 'lr-1',
        status: 'CANCELLED',
        totalDays: decimal(1),
      });

      const result = await service.cancelMyRequest('user-1', 'lr-1', actor);
      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('decide', () => {
    const pendingRequest = {
      id: 'lr-1',
      code: 'LV-0042',
      employeeId: 'emp-1',
      leaveTypeId: 'lt-1',
      startDate: new Date('2026-09-14'),
      endDate: new Date('2026-09-14'),
      totalDays: decimal(1),
      status: 'PENDING',
    };

    it('throws for an unknown request', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(null);
      await expect(
        service.decide('missing', { decision: 'APPROVED' }, actor),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects deciding an already-decided request', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({
        ...pendingRequest,
        status: 'APPROVED',
      });
      await expect(
        service.decide('lr-1', { decision: 'APPROVED' }, actor),
      ).rejects.toThrow(ConflictException);
    });

    it('rejecting does not touch balances or attendance', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(pendingRequest);
      prisma.leaveRequest.update.mockResolvedValue({
        ...pendingRequest,
        status: 'REJECTED',
      });

      await service.decide('lr-1', { decision: 'REJECTED' }, actor);

      expect(prisma.leaveBalance.upsert).not.toHaveBeenCalled();
      expect(prisma.attendanceDay.create).not.toHaveBeenCalled();
      expect(prisma.attendanceDay.update).not.toHaveBeenCalled();
    });

    it('approving records usage and marks the covered day(s) ON_LEAVE', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(pendingRequest);
      prisma.leaveRequest.update.mockResolvedValue({
        ...pendingRequest,
        status: 'APPROVED',
      });
      prisma.leaveType.findUniqueOrThrow.mockResolvedValue({
        id: 'lt-1',
        defaultAnnualDays: decimal(12),
      });
      prisma.attendanceDay.findUnique.mockResolvedValue(null);

      await service.decide('lr-1', { decision: 'APPROVED' }, actor);

      expect(prisma.leaveBalance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: 'emp-1',
              leaveTypeId: 'lt-1',
              year: 2026,
            },
          },
        }),
      );
      expect(prisma.attendanceDay.create).toHaveBeenCalledWith({
        data: {
          employeeId: 'emp-1',
          date: pendingRequest.startDate,
          status: 'ON_LEAVE',
          leaveRequestId: 'lr-1',
        },
      });
    });

    it('approving updates an existing AttendanceDay instead of creating a duplicate', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(pendingRequest);
      prisma.leaveRequest.update.mockResolvedValue({
        ...pendingRequest,
        status: 'APPROVED',
      });
      prisma.leaveType.findUniqueOrThrow.mockResolvedValue({
        id: 'lt-1',
        defaultAnnualDays: decimal(12),
      });
      prisma.attendanceDay.findUnique.mockResolvedValue({ id: 'day-1' });

      await service.decide('lr-1', { decision: 'APPROVED' }, actor);

      expect(prisma.attendanceDay.update).toHaveBeenCalledWith({
        where: { id: 'day-1' },
        data: { status: 'ON_LEAVE', leaveRequestId: 'lr-1' },
      });
      expect(prisma.attendanceDay.create).not.toHaveBeenCalled();
    });
  });
});
