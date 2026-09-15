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
      update: vi.fn().mockResolvedValue(undefined),
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
  let notificationsService: { createForEmployee: ReturnType<typeof vi.fn> };
  let attendanceService: { unmarkApprovedLeave: ReturnType<typeof vi.fn> };
  let service: LeaveService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
    sequenceService = { next: vi.fn().mockResolvedValue(42) };
    auditService = { log: vi.fn().mockResolvedValue(undefined) };
    notificationsService = { createForEmployee: vi.fn().mockResolvedValue(undefined) };
    attendanceService = { unmarkApprovedLeave: vi.fn().mockResolvedValue(undefined) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new LeaveService(
      prisma as any,
      auditService as any,
      sequenceService as any,
      notificationsService as any,
      attendanceService as any,
    );
  });

  describe('getBalancesForUser', () => {
    it('prepends a synthetic "Monthly" free-budget row, then synthesizes from LeaveType.defaultAnnualDays when no balance row exists', async () => {
      prisma.leaveType.findMany.mockResolvedValue([
        {
          id: 'lt-1',
          key: 'casual',
          name: 'Casual Leave',
          defaultAnnualDays: decimal(12),
        },
      ]);
      prisma.leaveBalance.findMany.mockResolvedValue([]);
      prisma.leaveRequest.findMany.mockResolvedValue([]); // nothing committed this month

      const result = await service.getBalancesForUser('user-1');

      expect(result).toEqual([
        {
          leaveTypeId: 'monthly-budget',
          leaveTypeKey: 'monthly-budget',
          leaveTypeName: 'Monthly',
          year: new Date().getFullYear(),
          allocatedDays: 1,
          carriedOverDays: 0,
          usedDays: 0,
          remainingDays: 1,
        },
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
      prisma.leaveRequest.findMany.mockResolvedValue([]);

      const result = await service.getBalancesForUser('user-1');
      expect(result[1]).toMatchObject({
        allocatedDays: 12,
        carriedOverDays: 2,
        usedDays: 4,
        remainingDays: 10,
      });
    });

    it('reflects already-committed requests this month in the Monthly row', async () => {
      prisma.leaveType.findMany.mockResolvedValue([]);
      prisma.leaveBalance.findMany.mockResolvedValue([]);
      prisma.leaveRequest.findMany.mockResolvedValue([
        { dayType: 'HALF_DAY' },
      ]);

      const result = await service.getBalancesForUser('user-1');
      expect(result[0]).toMatchObject({
        leaveTypeKey: 'monthly-budget',
        usedDays: 0.5,
        remainingDays: 0.5,
      });
    });
  });

  describe('applyLeave', () => {
    const dto = {
      startDate: '2026-09-14',
      endDate: '2026-09-14',
      reason: 'Family function',
    };

    beforeEach(() => {
      prisma.leaveType.findUniqueOrThrow.mockImplementation(({ where }: { where: { key: string } }) => {
        if (where.key === 'casual-leave-1-day') {
          return Promise.resolve({ id: 'lt-casual', key: 'casual-leave-1-day', name: 'Casual Leave' });
        }
        return Promise.resolve({ id: 'lt-lop', key: 'loss-of-pay', name: 'Loss of Pay' });
      });
      prisma.leaveRequest.findMany.mockResolvedValue([]); // nothing committed this month by default
      prisma.leaveRequest.create.mockResolvedValue({
        id: 'lr-1',
        code: 'LV-0042',
        totalDays: decimal(1),
      });
    });

    it('rejects a multi-day (non-single-day) request', async () => {
      await expect(
        service.applyLeave(
          'user-1',
          { ...dto, startDate: '2026-09-14', endDate: '2026-09-15' },
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

    it('creates a full-day request as Casual Leave (free) when nothing else is committed this month', async () => {
      const result = await service.applyLeave('user-1', dto, actor);

      expect(sequenceService.next).toHaveBeenCalledWith('leaveRequestCode');
      expect(prisma.leaveRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: 'LV-0042',
            leaveTypeId: 'lt-casual',
            dayType: 'FULL_DAY',
            totalDays: 1,
          }),
        }),
      );
      expect(result.autoConvertedToLossOfPay).toBe(false);
    });

    it('assigns Loss of Pay once the monthly free budget is exhausted by an already-committed request', async () => {
      // A full day already committed this month uses up the entire budget.
      prisma.leaveRequest.findMany.mockResolvedValue([
        { id: 'lr-existing', startDate: new Date('2026-09-01'), dayType: 'FULL_DAY' },
      ]);

      const result = await service.applyLeave('user-1', dto, actor);

      expect(prisma.leaveRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ leaveTypeId: 'lt-lop', totalDays: 1 }),
        }),
      );
      expect(result.autoConvertedToLossOfPay).toBe(true);
    });

    it('a pending (not yet approved) request already counts toward the monthly budget', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([
        { id: 'lr-pending', startDate: new Date('2026-09-01'), dayType: 'FULL_DAY' },
      ]);
      // The query itself is scoped to PENDING+APPROVED - assert it was called that way.
      await service.applyLeave('user-1', dto, actor);

      const call = prisma.leaveRequest.findMany.mock.calls[0][0];
      expect(call.where.status.in).toEqual(['PENDING', 'APPROVED']);
    });

    it('stores totalDays as the deduction weight for the chosen duration, not the budget weight', async () => {
      // Exhaust the budget first so this Short Leave request gets charged.
      prisma.leaveRequest.findMany.mockResolvedValue([
        { id: 'lr-existing', startDate: new Date('2026-09-01'), dayType: 'FULL_DAY' },
      ]);

      await service.applyLeave('user-1', { ...dto, dayType: 'SHORT_LEAVE' }, actor);

      expect(prisma.leaveRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ dayType: 'SHORT_LEAVE', totalDays: 0.25 }),
        }),
      );
    });

    it('2 half days in the same month are both free (within the shared budget)', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([
        { id: 'lr-existing', startDate: new Date('2026-09-01'), dayType: 'HALF_DAY' },
      ]);

      const result = await service.applyLeave(
        'user-1',
        { ...dto, dayType: 'HALF_DAY' },
        actor,
      );

      expect(prisma.leaveRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ leaveTypeId: 'lt-casual' }) }),
      );
      expect(result.autoConvertedToLossOfPay).toBe(false);
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

    it('rejects cancelling an already-rejected request', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'lr-1',
        employeeId: 'emp-1',
        status: 'REJECTED',
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
      expect(prisma.leaveBalance.update).not.toHaveBeenCalled();
      expect(attendanceService.unmarkApprovedLeave).not.toHaveBeenCalled();
    });

    it('rejects self-cancelling an approved request that has already started', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      prisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'lr-1',
        employeeId: 'emp-1',
        leaveTypeId: 'lt-1',
        status: 'APPROVED',
        startDate: yesterday,
        endDate: yesterday,
        totalDays: decimal(1),
      });
      await expect(
        service.cancelMyRequest('user-1', 'lr-1', actor),
      ).rejects.toThrow(ConflictException);
      expect(prisma.leaveRequest.update).not.toHaveBeenCalled();
    });

    it("cancels a future-dated approved request, reversing the balance and un-marking attendance", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      prisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'lr-1',
        code: 'LV-0001',
        employeeId: 'emp-1',
        leaveTypeId: 'lt-1',
        status: 'APPROVED',
        startDate: tomorrow,
        endDate: tomorrow,
        totalDays: decimal(1),
      });
      prisma.leaveRequest.update.mockResolvedValue({
        id: 'lr-1',
        status: 'CANCELLED',
        totalDays: decimal(1),
      });

      const result = await service.cancelMyRequest('user-1', 'lr-1', actor);

      expect(result.status).toBe('CANCELLED');
      const balanceUpdateArgs = prisma.leaveBalance.update.mock.calls[0][0];
      expect(balanceUpdateArgs.where.employeeId_leaveTypeId_year).toEqual({
        employeeId: 'emp-1',
        leaveTypeId: 'lt-1',
        year: tomorrow.getFullYear(),
      });
      expect(balanceUpdateArgs.data.usedDays.decrement.toNumber()).toBe(1);
      expect(attendanceService.unmarkApprovedLeave).toHaveBeenCalledWith(
        'emp-1',
        tomorrow,
        tomorrow,
        'lr-1',
      );
    });
  });

  describe('revoke', () => {
    it('rejects revoking a request that is not approved', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'lr-1',
        employeeId: 'emp-1',
        status: 'PENDING',
      });
      await expect(service.revoke('lr-1', {}, actor)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.leaveRequest.update).not.toHaveBeenCalled();
    });

    it('revokes an already-started approved request, reversing balance and attendance regardless of date', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      prisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'lr-1',
        code: 'LV-0001',
        employeeId: 'emp-1',
        leaveTypeId: 'lt-1',
        status: 'APPROVED',
        startDate: yesterday,
        endDate: yesterday,
        totalDays: decimal(1),
        decisionNote: null,
      });
      prisma.leaveRequest.update.mockResolvedValue({
        id: 'lr-1',
        status: 'CANCELLED',
        totalDays: decimal(1),
      });
      prisma.employee.findUnique.mockResolvedValue({
        managerId: 'mgr-1',
        firstName: 'Ritika',
        lastName: 'Rajan',
      });

      const result = await service.revoke('lr-1', { note: 'Wrong employee' }, actor);

      expect(result.status).toBe('CANCELLED');
      const balanceUpdateArgs = prisma.leaveBalance.update.mock.calls[0][0];
      expect(balanceUpdateArgs.data.usedDays.decrement.toNumber()).toBe(1);
      expect(attendanceService.unmarkApprovedLeave).toHaveBeenCalledWith(
        'emp-1',
        yesterday,
        yesterday,
        'lr-1',
      );
      expect(notificationsService.createForEmployee).toHaveBeenCalledWith(
        'emp-1',
        expect.objectContaining({ title: 'Approved leave revoked' }),
      );
      expect(notificationsService.createForEmployee).toHaveBeenCalledWith(
        'mgr-1',
        expect.objectContaining({ title: 'Approved leave revoked' }),
      );
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
