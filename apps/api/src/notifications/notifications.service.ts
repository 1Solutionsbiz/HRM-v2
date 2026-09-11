import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PushSubscriptionsService, type PushPayload } from '../push-subscriptions/push-subscriptions.service.js';
import type { NotificationType } from '../generated/prisma/enums.js';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  description: string;
  linkUrl?: string;
}

/**
 * Self-service, not admin-managed: every route reads/writes only the
 * calling user's own notifications (scoped by `authContext.userId`, not a
 * `:userId` path param), so nothing here is behind `@RequirePermissions()`
 * — being authenticated is enough to see your own notifications. `create()`
 * has no controller route at all; it's called by other modules (Leave,
 * Expenses, ...) when something happens a user should be notified about.
 *
 * Every notification also gets a push sent via pushQuietly() (both
 * create() and createForUsers() call it), so every caller of this service
 * gets push for free without any change on their end. pushQuietly is a
 * second, redundant safety net on top of PushSubscriptionsService.
 * sendToUser's own internal try/catch - deliberately double-guarded,
 * because create()/createForEmployee() sit directly inside business-
 * critical flows (leave approval, expense decisions, resignation
 * decisions, ...) that never wrap this call in their own try/catch. A
 * push subsystem hiccup (even one sendToUser itself doesn't anticipate,
 * e.g. its own findMany query failing) must never be able to fail one of
 * those.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushSubscriptionsService: PushSubscriptionsService,
  ) {}

  private async pushQuietly(userId: string, payload: PushPayload) {
    try {
      await this.pushSubscriptionsService.sendToUser(userId, payload);
    } catch (err) {
      this.logger.warn(`Push failed for user ${userId}: ${(err as Error).message}`);
    }
  }

  async create(input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({ data: input });
    await this.pushQuietly(input.userId, {
      title: input.title,
      body: input.description,
      url: input.linkUrl,
    });
    return notification;
  }

  /**
   * Bulk fan-out for company-wide events (e.g. a published announcement) -
   * one `createMany` instead of N sequential `create` calls. Push still
   * has to go per-user (there's no bulk-send in the Web Push protocol
   * itself), so that part isn't a single query either way.
   */
  async createForUsers(userIds: string[], input: Omit<CreateNotificationInput, 'userId'>) {
    if (userIds.length === 0) return { count: 0 };
    const result = await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({ ...input, userId })),
    });
    await Promise.all(
      userIds.map((userId) =>
        this.pushQuietly(userId, {
          title: input.title,
          body: input.description,
          url: input.linkUrl,
        }),
      ),
    );
    return result;
  }

  /**
   * `Notification.userId` is a User id, but most domain services (Leave,
   * Expenses, Resignation, Tickets) only carry an `Employee` id - this
   * resolves that lookup in one place instead of every call site repeating
   * it. Silently no-ops if the employee has no linked user (shouldn't
   * happen for a real employee, but a notification is never worth failing
   * the actual decision/action over).
   */
  async createForEmployee(
    employeeId: string,
    input: Omit<CreateNotificationInput, 'userId'>,
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { userId: true },
    });
    if (!employee) return null;
    return this.create({ ...input, userId: employee.userId });
  }

  async findAllForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId !== userId) {
      // 404, not 403: existence of another user's notification id is not
      // information this endpoint should confirm.
      throw new NotFoundException('Notification not found');
    }
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string): Promise<{ count: number }> {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
