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

  /**
   * Bulk fan-out for company-wide events (e.g. a published announcement) -
   * one `createMany` instead of N sequential `create` calls.
   */
  async createForUsers(userIds: string[], input: Omit<CreateNotificationInput, 'userId'>) {
    if (userIds.length === 0) return { count: 0 };
    return this.prisma.notification.createMany({
      data: userIds.map((userId) => ({ ...input, userId })),
    });
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
