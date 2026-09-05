import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service.js';
import type { AuthContext } from '../common/auth-context.js';

function buildPrismaMock() {
  return {
    employee: { findUnique: vi.fn() },
    attendanceDay: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    attendanceEvent: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    },
    holiday: { findMany: vi.fn().mockResolvedValue([]) },
    attendancePolicy: { findUnique: vi.fn() },
  };
}

const DEFAULT_POLICY = {
  id: 'singleton',
  standardStartTime: new Date(Date.UTC(1970, 0, 1, 9, 30, 0)),
  standardEndTime: new Date(Date.UTC(1970, 0, 1, 18, 30, 0)),
  graceMinutes: 15,
  halfDayThresholdHours: { toNumber: () => 4.5 },
  fullDayHours: { toNumber: () => 9 },
  workingWeekdays: [1, 2, 3, 4, 5],
};

const actor: AuthContext = {
  userId: 'user-1',
  sessionId: 's1',
  email: 'a@example.com',
  roles: ['employee'],
  permissions: [],
};

describe('AttendanceService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let auditService: { log: ReturnType<typeof vi.fn> };
  let service: AttendanceService;

  beforeEach(() => {
    vi.useFakeTimers();
    // A Tuesday, well inside the grace-window boundary tests need to move around.
    vi.setSystemTime(new Date('2026-08-04T04:00:00.000Z'));

    prisma = buildPrismaMock();
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
    prisma.attendancePolicy.findUnique.mockResolvedValue(DEFAULT_POLICY);
    auditService = { log: vi.fn().mockResolvedValue(undefined) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new AttendanceService(prisma as any, auditService as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkIn', () => {
    it('throws when the calling user has no linked employee profile', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      await expect(service.checkIn(actor, {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creates a new AttendanceDay and a CHECK_IN event when none exists yet', async () => {
      prisma.attendanceDay.findUnique.mockResolvedValue(null);
      prisma.attendanceDay.create.mockResolvedValue({
        id: 'day-1',
        status: 'PRESENT',
        leaveRequestId: null,
      });
      prisma.attendanceDay.findUniqueOrThrow.mockResolvedValue({
        id: 'day-1',
        status: 'PRESENT',
        leaveRequestId: null,
        date: new Date('2026-08-04'),
      });
      prisma.attendanceEvent.findMany.mockResolvedValue([
        {
          id: 'e1',
          type: 'CHECK_IN',
          occurredAt: new Date('2026-08-04T04:00:00.000Z'),
        },
      ]);
      prisma.attendanceDay.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'day-1', date: new Date('2026-08-04'), ...data }),
      );

      const result = await service.checkIn(actor, { ipAddress: '127.0.0.1' });

      expect(prisma.attendanceDay.create).toHaveBeenCalledWith({
        data: { employeeId: 'emp-1', date: expect.any(Date) },
      });
      expect(prisma.attendanceEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'CHECK_IN',
            attendanceDayId: 'day-1',
          }),
        }),
      );
      expect(result.punchState).toBe('CHECKED_IN');
    });

    it('rejects a second check-in on the same day', async () => {
      prisma.attendanceDay.findUnique.mockResolvedValue({ id: 'day-1' });
      prisma.attendanceEvent.findFirst.mockResolvedValue({
        id: 'e1',
        type: 'CHECK_IN',
      });

      await expect(service.checkIn(actor, {})).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.attendanceEvent.create).not.toHaveBeenCalled();
    });
  });

  describe('checkOut', () => {
    it('rejects checking out with no attendance day for today', async () => {
      prisma.attendanceDay.findUnique.mockResolvedValue(null);
      await expect(service.checkOut(actor, {})).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects checking out before checking in', async () => {
      prisma.attendanceDay.findUnique.mockResolvedValue({ id: 'day-1' });
      prisma.attendanceEvent.findMany.mockResolvedValue([]);
      await expect(service.checkOut(actor, {})).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects a second check-out on the same day', async () => {
      prisma.attendanceDay.findUnique.mockResolvedValue({ id: 'day-1' });
      prisma.attendanceEvent.findMany.mockResolvedValue([
        { type: 'CHECK_IN' },
        { type: 'CHECK_OUT' },
      ]);
      await expect(service.checkOut(actor, {})).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('getTodayForUser', () => {
    it('returns NOT_CHECKED_IN when no attendance day exists', async () => {
      prisma.attendanceDay.findUnique.mockResolvedValue(null);
      const result = await service.getTodayForUser('user-1');
      expect(result.punchState).toBe('NOT_CHECKED_IN');
    });

    it('returns CHECKED_IN when checked in but not out', async () => {
      prisma.attendanceDay.findUnique.mockResolvedValue({
        id: 'day-1',
        date: new Date('2026-08-04'),
        status: 'PRESENT',
        firstCheckInAt: new Date('2026-08-04T04:00:00.000Z'),
        lastCheckOutAt: null,
        workedMinutes: null,
        lateMinutes: 0,
      });
      const result = await service.getTodayForUser('user-1');
      expect(result.punchState).toBe('CHECKED_IN');
    });
  });

  describe('recomputeDay via checkIn/checkOut outcomes', () => {
    function setupDay(
      events: { id: string; type: string; occurredAt: Date }[],
    ) {
      prisma.attendanceDay.findUniqueOrThrow.mockResolvedValue({
        id: 'day-1',
        status: 'PRESENT',
        leaveRequestId: null,
        date: new Date('2026-08-04'),
      });
      prisma.attendanceEvent.findMany.mockResolvedValue(events);
      prisma.attendanceDay.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'day-1', date: new Date('2026-08-04'), ...data }),
      );
    }

    it('marks a check-in on time and a full workday as PRESENT', async () => {
      // Both timestamps built with local setHours so the test is robust to
      // whatever timezone this happens to run in (computeLateMinutes reads
      // local getters, same as the service).
      const onTimeCheckIn = new Date();
      onTimeCheckIn.setHours(9, 30, 0, 0);
      const fullDayCheckOut = new Date(onTimeCheckIn);
      fullDayCheckOut.setHours(onTimeCheckIn.getHours() + 9);

      prisma.attendanceDay.findUnique.mockResolvedValue({ id: 'day-1' });
      // checkOut()'s own existence check (has a CHECK_IN, no CHECK_OUT yet).
      prisma.attendanceEvent.findMany.mockResolvedValueOnce([
        { type: 'CHECK_IN' },
      ]);
      setupDay([
        { id: 'e1', type: 'CHECK_IN', occurredAt: onTimeCheckIn },
        { id: 'e2', type: 'CHECK_OUT', occurredAt: fullDayCheckOut },
      ]);

      const result = await service.checkOut(actor, {});
      expect(result.status).toBe('PRESENT');
      expect(result.lateMinutes).toBe(0);
    });

    it('marks a check-in past the grace window as LATE with nonzero lateMinutes', async () => {
      // Standard start 09:30 local, grace 15 min -> anything after 09:45 local is late.
      const lateCheckIn = new Date();
      lateCheckIn.setHours(10, 30, 0, 0); // 45 minutes past grace, in local time
      prisma.attendanceDay.findUnique.mockResolvedValue({ id: 'day-1' });
      setupDay([{ id: 'e1', type: 'CHECK_IN', occurredAt: lateCheckIn }]);

      const result = await service.checkIn(actor, {});

      expect(result.status).toBe('LATE');
      expect(result.lateMinutes).toBeGreaterThan(0);
    });

    it('marks a short day (below the half-day threshold) as HALF_DAY', async () => {
      const onTimeCheckIn = new Date();
      onTimeCheckIn.setHours(9, 30, 0, 0);
      const shortCheckOut = new Date(onTimeCheckIn);
      shortCheckOut.setHours(onTimeCheckIn.getHours() + 3); // well under the 4.5h threshold

      prisma.attendanceDay.findUnique.mockResolvedValue({ id: 'day-1' });
      prisma.attendanceEvent.findMany.mockResolvedValueOnce([
        { type: 'CHECK_IN' },
      ]);
      setupDay([
        { id: 'e1', type: 'CHECK_IN', occurredAt: onTimeCheckIn },
        { id: 'e2', type: 'CHECK_OUT', occurredAt: shortCheckOut },
      ]);

      const result = await service.checkOut(actor, {});
      expect(result.status).toBe('HALF_DAY');
    });

    it('a correction event supersedes the original regardless of occurredAt ordering', async () => {
      // Insertion order (id ascending) determines the "winner", not occurredAt.
      const original = {
        id: 'e1',
        type: 'CHECK_IN',
        occurredAt: new Date('2026-08-04T04:00:00.000Z'),
      };
      const correctedLater = {
        id: 'e2',
        type: 'CHECK_IN',
        occurredAt: new Date('2026-08-04T02:00:00.000Z'),
      }; // earlier clock time, later insertion
      setupDay([original, correctedLater]);
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
      prisma.attendanceDay.findUnique.mockResolvedValue({ id: 'day-1' });

      const result = await service.recordCorrection(
        'emp-1',
        {
          type: 'CHECK_IN',
          occurredAt: correctedLater.occurredAt.toISOString(),
        },
        actor,
      );

      expect(result.firstCheckInAt).toEqual(correctedLater.occurredAt);
    });
  });

  describe('recordCorrection', () => {
    it('throws for an unknown employee', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      await expect(
        service.recordCorrection(
          'missing',
          { type: 'CHECK_IN', occurredAt: new Date().toISOString() },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPolicyOrThrow', () => {
    it('throws a clear error instead of guessing when unseeded', async () => {
      prisma.attendancePolicy.findUnique.mockResolvedValue(null);
      await expect(service.getPolicyOrThrow()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getHistoryForUser', () => {
    it('rejects from after to', async () => {
      await expect(
        service.getHistoryForUser('user-1', {
          from: '2026-08-10',
          to: '2026-08-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a range spanning more than 90 days', async () => {
      await expect(
        service.getHistoryForUser('user-1', {
          from: '2026-01-01',
          to: '2026-06-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('synthesizes WEEKEND and ABSENT for days with no AttendanceDay row', async () => {
      // Range: Sat 2026-08-01 through Tue 2026-08-04 (today). No AttendanceDay
      // rows, no holidays.
      const result = await service.getHistoryForUser('user-1', {
        from: '2026-08-01',
        to: '2026-08-04',
      });

      const byDate = Object.fromEntries(
        result.map((day) => [day.date, day.status]),
      );
      expect(byDate['2026-08-01']).toBe('WEEKEND'); // Saturday
      expect(byDate['2026-08-02']).toBe('WEEKEND'); // Sunday
      expect(byDate['2026-08-03']).toBe('ABSENT'); // Monday, past, no record
      // 2026-08-04 is "today" in this test's fake clock — not synthesized as absent.
      expect(byDate['2026-08-04']).toBeUndefined();
    });

    it('synthesizes HOLIDAY for a date present in the Holiday table', async () => {
      prisma.holiday.findMany.mockResolvedValue([
        { date: new Date('2026-08-03') },
      ]);
      const result = await service.getHistoryForUser('user-1', {
        from: '2026-08-03',
        to: '2026-08-03',
      });
      expect(result[0]).toMatchObject({
        date: '2026-08-03',
        status: 'HOLIDAY',
      });
    });

    it('uses the real AttendanceDay row when one exists', async () => {
      prisma.attendanceDay.findMany.mockResolvedValue([
        {
          date: new Date('2026-08-03'),
          status: 'LATE',
          firstCheckInAt: new Date('2026-08-03T05:00:00.000Z'),
          lastCheckOutAt: new Date('2026-08-03T13:00:00.000Z'),
          workedMinutes: 480,
          lateMinutes: 20,
        },
      ]);
      const result = await service.getHistoryForUser('user-1', {
        from: '2026-08-03',
        to: '2026-08-03',
      });
      expect(result[0]).toMatchObject({
        date: '2026-08-03',
        status: 'LATE',
        lateMinutes: 20,
      });
    });
  });
});
