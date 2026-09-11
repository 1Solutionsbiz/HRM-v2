import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';

function buildPrismaMock() {
  return {
    notification: {
      create: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };
}

function buildPushSubscriptionsMock() {
  return { sendToUser: vi.fn().mockResolvedValue(undefined) };
}

describe('NotificationsService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let pushSubscriptions: ReturnType<typeof buildPushSubscriptionsMock>;
  let service: NotificationsService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    pushSubscriptions = buildPushSubscriptionsMock();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new NotificationsService(prisma as any, pushSubscriptions as any);
  });

  describe('create', () => {
    const input = {
      userId: 'u1',
      type: 'LEAVE' as const,
      title: 'Leave approved',
      description: 'Your leave was approved.',
      linkUrl: '/leave',
    };

    it('writes the notification and sends a push with the same content', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'n1', ...input });
      const result = await service.create(input);
      expect(prisma.notification.create).toHaveBeenCalledWith({ data: input });
      expect(pushSubscriptions.sendToUser).toHaveBeenCalledWith('u1', {
        title: 'Leave approved',
        body: 'Your leave was approved.',
        url: '/leave',
      });
      expect(result).toEqual({ id: 'n1', ...input });
    });

    it('still returns the notification when the push send rejects - a push failure must never fail the call site (leave approval, expense decisions, ...)', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'n1', ...input });
      pushSubscriptions.sendToUser.mockRejectedValueOnce(new Error('push service down'));
      const result = await service.create(input);
      expect(result).toEqual({ id: 'n1', ...input });
    });
  });

  describe('createForUsers', () => {
    it('bulk-creates then sends a push to every user', async () => {
      prisma.notification.createMany.mockResolvedValue({ count: 2 });
      const input = { type: 'ANNOUNCEMENT' as const, title: 'New policy', description: 'See the handbook.' };
      const result = await service.createForUsers(['u1', 'u2'], input);
      expect(prisma.notification.createMany).toHaveBeenCalledWith({
        data: [{ ...input, userId: 'u1' }, { ...input, userId: 'u2' }],
      });
      expect(pushSubscriptions.sendToUser).toHaveBeenCalledTimes(2);
      expect(pushSubscriptions.sendToUser).toHaveBeenCalledWith('u1', {
        title: 'New policy',
        body: 'See the handbook.',
        url: undefined,
      });
      expect(result).toEqual({ count: 2 });
    });

    it('no-ops for an empty user list without touching push at all', async () => {
      const result = await service.createForUsers([], { type: 'SYSTEM' as const, title: 'x', description: 'y' });
      expect(prisma.notification.createMany).not.toHaveBeenCalled();
      expect(pushSubscriptions.sendToUser).not.toHaveBeenCalled();
      expect(result).toEqual({ count: 0 });
    });

    it("one user's push rejecting doesn't stop the others or fail the call", async () => {
      prisma.notification.createMany.mockResolvedValue({ count: 2 });
      pushSubscriptions.sendToUser.mockImplementation((userId: string) =>
        userId === 'u1' ? Promise.reject(new Error('push service down')) : Promise.resolve(undefined),
      );
      const result = await service.createForUsers(['u1', 'u2'], { type: 'SYSTEM' as const, title: 'x', description: 'y' });
      expect(pushSubscriptions.sendToUser).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ count: 2 });
    });
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
