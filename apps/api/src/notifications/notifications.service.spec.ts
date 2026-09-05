import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';

function buildPrismaMock() {
  return {
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };
}

describe('NotificationsService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: NotificationsService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new NotificationsService(prisma as any);
  });

  it('lists only the given user notifications, newest first', async () => {
    await service.findAllForUser('u1');
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  describe('markRead', () => {
    it('throws for a nonexistent notification', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);
      await expect(service.markRead('u1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws (404, not exposing existence) when the notification belongs to someone else', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'n1',
        userId: 'someone-else',
      });
      await expect(service.markRead('u1', 'n1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('marks a matching notification read', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'n1',
        userId: 'u1',
      });
      await service.markRead('u1', 'n1');
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: { isRead: true },
      });
    });
  });

  it('markAllRead only touches the given user unread notifications', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 3 });
    const result = await service.markAllRead('u1');
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', isRead: false },
      data: { isRead: true },
    });
    expect(result).toEqual({ count: 3 });
  });
});
