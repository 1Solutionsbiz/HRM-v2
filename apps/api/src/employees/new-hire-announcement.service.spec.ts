import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { NewHireAnnouncementService } from './new-hire-announcement.service.js';

function buildPrismaMock() {
  return {
    employee: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
    },
  };
}

const ritika = {
  id: 'emp-ritika',
  firstName: 'Ritika',
  lastName: 'Sharma',
  phone: '9876543210',
  status: 'ACTIVE',
  welcomeEmailSentAt: null,
  department: { name: 'Digital Marketing' },
  designation: { title: 'SEO Executive' },
  user: { email: 'ritika@1solutions.biz' },
};

describe('NewHireAnnouncementService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let mailService: { sendNewHireAnnouncement: ReturnType<typeof vi.fn> };
  let service: NewHireAnnouncementService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-14T03:30:00Z'));
    prisma = buildPrismaMock();
    mailService = { sendNewHireAnnouncement: vi.fn().mockResolvedValue(undefined) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new NewHireAnnouncementService(prisma as any, mailService as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('announceTodaysNewHires', () => {
    it('queries active, not-yet-announced employees who joined within the last 7 days (a catch-up window, not just an exact-today match)', async () => {
      await service.announceTodaysNewHires();
      expect(prisma.employee.findMany).toHaveBeenNthCalledWith(1, {
        where: {
          status: 'ACTIVE',
          dateOfJoining: { gte: new Date(Date.UTC(2026, 8, 7)), lte: new Date(Date.UTC(2026, 8, 14)) },
          welcomeEmailSentAt: null,
        },
        include: { department: true, designation: true, user: { select: { email: true } } },
      });
    });

    it('emails every other active employee with an active login, excluding the new hire, then marks it sent', async () => {
      prisma.employee.findMany
        .mockResolvedValueOnce([ritika]) // today's new hires
        .mockResolvedValueOnce([
          { user: { email: 'atul@1solutions.biz' } },
          { user: { email: 'nikita@1solutions.biz' } },
        ]); // recipients (excludes Ritika by construction of the where clause)

      await service.announceTodaysNewHires();

      expect(mailService.sendNewHireAnnouncement).toHaveBeenCalledWith(
        ['atul@1solutions.biz', 'nikita@1solutions.biz'],
        {
          firstName: 'Ritika',
          lastName: 'Sharma',
          designation: 'SEO Executive',
          department: 'Digital Marketing',
          workEmail: 'ritika@1solutions.biz',
          phone: '9876543210',
        },
      );
      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-ritika' },
        data: { welcomeEmailSentAt: expect.any(Date) },
      });
    });

    it('excludes the new hire and deactivated/past employees from the recipient query', async () => {
      prisma.employee.findMany.mockResolvedValueOnce([ritika]).mockResolvedValueOnce([]);

      await service.announceTodaysNewHires();

      expect(prisma.employee.findMany).toHaveBeenNthCalledWith(2, {
        where: { status: 'ACTIVE', id: { not: 'emp-ritika' }, user: { isActive: true } },
        select: { user: { select: { email: true } } },
      });
    });

    it('does nothing when nobody is joining today', async () => {
      prisma.employee.findMany.mockResolvedValue([]);
      await service.announceTodaysNewHires();
      expect(mailService.sendNewHireAnnouncement).not.toHaveBeenCalled();
      expect(prisma.employee.update).not.toHaveBeenCalled();
    });
  });

  describe('sendTest', () => {
    it('previews a specific employee when given an id, and never marks welcomeEmailSentAt', async () => {
      prisma.employee.findUnique.mockResolvedValue(ritika);
      prisma.employee.findMany.mockResolvedValue([]); // recipients query

      const result = await service.sendTest('atul@1solutions.biz', 'emp-ritika');

      expect(prisma.employee.findUnique).toHaveBeenCalledWith({
        where: { id: 'emp-ritika' },
        include: { department: true, designation: true, user: { select: { email: true } } },
      });
      expect(mailService.sendNewHireAnnouncement).toHaveBeenCalledWith(
        ['atul@1solutions.biz'],
        expect.objectContaining({ firstName: 'Ritika', lastName: 'Sharma', isTest: true }),
      );
      expect(prisma.employee.update).not.toHaveBeenCalled();
      expect(result.employeeName).toBe('Ritika Sharma');
    });

    it('falls back to the most recently joined active employee when no id is given', async () => {
      prisma.employee.findFirst.mockResolvedValue(ritika);
      prisma.employee.findMany.mockResolvedValue([]);

      await service.sendTest('atul@1solutions.biz');

      expect(prisma.employee.findFirst).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
        orderBy: { dateOfJoining: 'desc' },
        include: { department: true, designation: true, user: { select: { email: true } } },
      });
    });

    it('throws when there is no employee to preview at all', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);
      await expect(service.sendTest('atul@1solutions.biz')).rejects.toThrow(NotFoundException);
    });
  });

  describe('sendNow', () => {
    it('sends the real announcement to every real recipient and marks it sent', async () => {
      prisma.employee.findUnique.mockResolvedValue(ritika);
      prisma.employee.findMany.mockResolvedValue([{ user: { email: 'atul@1solutions.biz' } }]);

      const result = await service.sendNow('emp-ritika');

      expect(mailService.sendNewHireAnnouncement).toHaveBeenCalledWith(
        ['atul@1solutions.biz'],
        expect.objectContaining({ firstName: 'Ritika', lastName: 'Sharma' }),
      );
      // Unlike sendTest, no isTest flag and a real recipient list, not just the caller.
      expect(mailService.sendNewHireAnnouncement.mock.calls[0][1].isTest).toBeUndefined();
      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-ritika' },
        data: { welcomeEmailSentAt: expect.any(Date) },
      });
      expect(result).toEqual({ employeeName: 'Ritika Sharma', recipientCount: 1 });
    });

    it('refuses to re-send once welcomeEmailSentAt is already set', async () => {
      prisma.employee.findUnique.mockResolvedValue({ ...ritika, welcomeEmailSentAt: new Date('2026-09-01') });
      await expect(service.sendNow('emp-ritika')).rejects.toThrow(/already announced/);
      expect(mailService.sendNewHireAnnouncement).not.toHaveBeenCalled();
    });

    it('refuses to announce someone who is not currently active', async () => {
      prisma.employee.findUnique.mockResolvedValue({ ...ritika, status: 'INACTIVE' });
      await expect(service.sendNow('emp-ritika')).rejects.toThrow(/currently active/);
      expect(mailService.sendNewHireAnnouncement).not.toHaveBeenCalled();
    });

    it('throws when the employee does not exist', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      await expect(service.sendNow('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
