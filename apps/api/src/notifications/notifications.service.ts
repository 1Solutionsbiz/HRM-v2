import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
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
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateNotificationInput) {
    return this.prisma.notification.create({ data: input });
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
