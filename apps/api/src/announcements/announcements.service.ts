import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { AuthContext } from '../common/auth-context.js';
import type { PublishAnnouncementDto } from './dto/publish-announcement.dto.js';

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Per-viewer read state via `AnnouncementRead`, fixing the legacy single
   * global read flag ("read" is a fact about a reader, not the
   * announcement — see docs/database-design.md).
   */
  async getAllForUser(userId: string) {
    const [announcements, reads] = await Promise.all([
      this.prisma.announcement.findMany({ orderBy: { publishedAt: 'desc' } }),
      this.prisma.announcementRead.findMany({ where: { userId } }),
    ]);
    const readAnnouncementIds = new Set(
      reads.map((read) => read.announcementId),
    );

    return announcements.map((announcement) => ({
      ...announcement,
      read: readAnnouncementIds.has(announcement.id),
    }));
  }

  async markRead(userId: string, announcementId: string): Promise<void> {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
    });
    if (!announcement) throw new NotFoundException('Announcement not found');

    await this.prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId, userId } },
      create: { announcementId, userId },
      update: {},
    });
  }

  async publish(dto: PublishAnnouncementDto, actor: AuthContext) {
    const announcement = await this.prisma.announcement.create({
      data: {
        title: dto.title,
        body: dto.body,
        imageUrl: dto.imageUrl,
        category: dto.category,
        publishedByUserId: actor.userId,
      },
    });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Announcement',
      targetId: announcement.id,
      description: `Published announcement: ${dto.title}`,
    });

    const activeEmployees = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: { userId: true },
    });
    await this.notificationsService.createForUsers(
      activeEmployees.map((e) => e.userId),
      {
        type: 'ANNOUNCEMENT',
        title: dto.title,
        description: dto.body.length > 140 ? `${dto.body.slice(0, 140)}…` : dto.body,
        linkUrl: '/announcements',
      },
    );

    return announcement;
  }
}
