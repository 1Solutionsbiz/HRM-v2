import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MissingCheckoutReminderService } from './missing-checkout-reminder.service.js';

function buildPrismaMock() {
  return { attendanceDay: { findMany: vi.fn().mockResolvedValue([]) } };
}

describe('MissingCheckoutReminderService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let notificationsService: {
    createForEmployee: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let service: MissingCheckoutReminderService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-11T15:30:00Z')); // 9 PM IST, Fri 11 Sept
    prisma = buildPrismaMock();
    notificationsService = {
      createForEmployee: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue(undefined),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new MissingCheckoutReminderService(prisma as any, notificationsService as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('remindMissingCheckouts', () => {
    it('queries only today, checked-in, still-no-checkout rows', async () => {
      await service.remindMissingCheckouts();
      expect(prisma.attendanceDay.findMany).toHaveBeenCalledWith({
        where: {
          date: new Date(Date.UTC(2026, 8, 11)),
          firstCheckInAt: { not: null },
          lastCheckOutAt: null,
        },
        select: { employeeId: true },
      });
    });

    it('sends an ATTENDANCE notification to every employee still missing a checkout', async () => {
      prisma.attendanceDay.findMany.mockResolvedValue([{ employeeId: 'emp-1' }, { employeeId: 'emp-2' }]);

      await service.remindMissingCheckouts();

      expect(notificationsService.createForEmployee).toHaveBeenCalledTimes(2);
      expect(notificationsService.createForEmployee).toHaveBeenCalledWith('emp-1', {
        type: 'ATTENDANCE',
        title: 'Forgot to check out?',
        description: "You checked in today but haven't checked out yet.",
        linkUrl: '/attendance',
      });
    });

    it('sends nothing when nobody is missing a checkout', async () => {
      prisma.attendanceDay.findMany.mockResolvedValue([]);
      await service.remindMissingCheckouts();
      expect(notificationsService.createForEmployee).not.toHaveBeenCalled();
    });
  });

  describe('sendTest', () => {
    it('sends one [TEST]-labelled preview to the caller only, never the real employees', async () => {
      prisma.attendanceDay.findMany.mockResolvedValue([{ employeeId: 'emp-1' }, { employeeId: 'emp-2' }]);

      const result = await service.sendTest('actor-1');

      expect(notificationsService.create).toHaveBeenCalledTimes(1);
      expect(notificationsService.create).toHaveBeenCalledWith({
        userId: 'actor-1',
        type: 'ATTENDANCE',
        title: '[TEST] Forgot to check out?',
        description: expect.stringContaining('2 employee(s)'),
        linkUrl: '/attendance',
      });
      expect(notificationsService.createForEmployee).not.toHaveBeenCalled();
      expect(result).toEqual({ missingCheckoutCount: 2 });
    });
  });
});
