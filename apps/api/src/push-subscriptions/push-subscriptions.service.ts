import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SubscribePushDto } from './dto/subscribe-push.dto.js';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY are optional (see EnvironmentVariables)
 * - same "falls back to a logged no-op" posture as MailService when SMTP
 * isn't configured, so a deploy without them set yet doesn't break
 * anything that calls sendToUser; it just doesn't push until they're set.
 */
@Injectable()
export class PushSubscriptionsService {
  private readonly logger = new Logger(PushSubscriptionsService.name);
  private readonly vapidConfigured: boolean;

  constructor(private readonly prisma: PrismaService) {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT ?? 'mailto:hr@1solutions.biz';
    this.vapidConfigured = !!publicKey && !!privateKey;
    if (this.vapidConfigured) {
      webpush.setVapidDetails(subject, publicKey!, privateKey!);
    } else {
      this.logger.warn('VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not set - push notifications are disabled until configured.');
    }
  }

  async subscribe(userId: string, dto: SubscribePushDto, userAgent?: string) {
    return this.prisma.pushSubscription.upsert({
      where: { userId_endpoint: { userId, endpoint: dto.endpoint } },
      create: {
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent,
      },
      update: {
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent,
      },
    });
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  /**
   * Called by NotificationsService for every notification type. Never
   * throws - a push failure must not fail the business action (leave
   * approval, ticket update, ...) it's attached to. A subscription the
   * push service reports as gone (404/410 - the user revoked permission,
   * uninstalled the PWA, etc.) is deleted so it stops being retried.
   */
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!this.vapidConfigured) return;

    const subscriptions = await this.prisma.pushSubscription.findMany({ where: { userId } });
    if (subscriptions.length === 0) return;

    const body = JSON.stringify(payload);
    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            body,
            // Without an explicit timeout, a hung push service (FCM/Mozilla)
            // holds this request open indefinitely - there's no default.
            // TTL is how long the push service itself may hold an
            // undelivered message for a briefly-offline device.
            { TTL: 86_400, timeout: 5_000 },
          );
        } catch (err) {
          const statusCode = err instanceof webpush.WebPushError ? err.statusCode : undefined;
          if (statusCode === 404 || statusCode === 410) {
            await this.prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => {});
          } else {
            this.logger.warn(`Push send failed for subscription ${subscription.id}: ${(err as Error).message}`);
          }
        }
      }),
    );
  }
}
