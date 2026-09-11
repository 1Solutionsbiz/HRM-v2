import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as webpush from 'web-push';
import { PushSubscriptionsService } from './push-subscriptions.service.js';

vi.mock('web-push', () => ({
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
  WebPushError: class WebPushError extends Error {
    constructor(
      message: string,
      public statusCode: number,
    ) {
      super(message);
    }
  },
}));

function buildPrismaMock() {
  return {
    pushSubscription: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
      findMany: vi.fn(),
    },
  };
}

describe('PushSubscriptionsService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: PushSubscriptionsService;

  beforeEach(() => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    prisma = buildPrismaMock();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new PushSubscriptionsService(prisma as any);
  });

  afterEach(() => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    vi.clearAllMocks();
  });

  describe('subscribe', () => {
    it('upserts by the (userId, endpoint) compound key', async () => {
      await service.subscribe('u1', { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } }, 'Mozilla/5.0');
      expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith({
        where: { userId_endpoint: { userId: 'u1', endpoint: 'https://push.example/abc' } },
        create: { userId: 'u1', endpoint: 'https://push.example/abc', p256dh: 'p', auth: 'a', userAgent: 'Mozilla/5.0' },
        update: { p256dh: 'p', auth: 'a', userAgent: 'Mozilla/5.0' },
      });
    });
  });

  describe('unsubscribe', () => {
    it('deletes only the calling user\'s matching subscription', async () => {
      await service.unsubscribe('u1', 'https://push.example/abc');
      expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1', endpoint: 'https://push.example/abc' },
      });
    });
  });

  describe('sendToUser', () => {
    it('does nothing when VAPID keys are not configured', async () => {
      delete process.env.VAPID_PUBLIC_KEY;
      const unconfigured = new PushSubscriptionsService(prisma as unknown as never);
      await unconfigured.sendToUser('u1', { title: 't', body: 'b' });
      expect(prisma.pushSubscription.findMany).not.toHaveBeenCalled();
    });

    it('does nothing when the user has no subscriptions', async () => {
      prisma.pushSubscription.findMany.mockResolvedValue([]);
      await service.sendToUser('u1', { title: 't', body: 'b' });
      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });

    it('sends to every subscription with a TTL and timeout set', async () => {
      prisma.pushSubscription.findMany.mockResolvedValue([
        { id: 's1', endpoint: 'https://push.example/1', p256dh: 'p1', auth: 'a1' },
        { id: 's2', endpoint: 'https://push.example/2', p256dh: 'p2', auth: 'a2' },
      ]);
      vi.mocked(webpush.sendNotification).mockResolvedValue({} as never);

      await service.sendToUser('u1', { title: 'Hi', body: 'There', url: '/x' });

      expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
      expect(webpush.sendNotification).toHaveBeenCalledWith(
        { endpoint: 'https://push.example/1', keys: { p256dh: 'p1', auth: 'a1' } },
        JSON.stringify({ title: 'Hi', body: 'There', url: '/x' }),
        { TTL: 86_400, timeout: 5_000 },
      );
    });

    it('deletes a subscription the push service reports as gone (410) and does not log it as a warning-worthy failure', async () => {
      prisma.pushSubscription.findMany.mockResolvedValue([
        { id: 's1', endpoint: 'https://push.example/1', p256dh: 'p1', auth: 'a1' },
      ]);
      vi.mocked(webpush.sendNotification).mockRejectedValue(new webpush.WebPushError('gone', 410, {}, '', 'https://push.example/1'));

      await service.sendToUser('u1', { title: 't', body: 'b' });

      expect(prisma.pushSubscription.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
    });

    it('leaves a subscription alone and just logs on a non-410/404 failure (e.g. a transient 500)', async () => {
      prisma.pushSubscription.findMany.mockResolvedValue([
        { id: 's1', endpoint: 'https://push.example/1', p256dh: 'p1', auth: 'a1' },
      ]);
      vi.mocked(webpush.sendNotification).mockRejectedValue(new webpush.WebPushError('server error', 500, {}, '', 'https://push.example/1'));

      await expect(service.sendToUser('u1', { title: 't', body: 'b' })).resolves.toBeUndefined();
      expect(prisma.pushSubscription.delete).not.toHaveBeenCalled();
    });

    it("never throws even if one subscription's send rejects with a non-WebPushError", async () => {
      prisma.pushSubscription.findMany.mockResolvedValue([
        { id: 's1', endpoint: 'https://push.example/1', p256dh: 'p1', auth: 'a1' },
      ]);
      vi.mocked(webpush.sendNotification).mockRejectedValue(new Error('ECONNRESET'));

      await expect(service.sendToUser('u1', { title: 't', body: 'b' })).resolves.toBeUndefined();
    });
  });
});
