import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service.js';
import type { AuthContext } from '../common/auth-context.js';

function buildPrismaMock() {
  return {
    announcement: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    announcementRead: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn(),
    },
  };
}

const actor: AuthContext = {
  userId: 'hr-1',
  sessionId: 's1',
  email: 'hr@example.com',
  roles: ['hr'],
  permissions: ['announcement:publish'],
};

describe('AnnouncementsService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let auditService: { log: ReturnType<typeof vi.fn> };
  let service: AnnouncementsService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    auditService = { log: vi.fn().mockResolvedValue(undefined) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new AnnouncementsService(prisma as any, auditService as any);
  });

  describe('getAllForUser', () => {
    it('marks an announcement read only for a user with a matching AnnouncementRead row', async () => {
      prisma.announcement.findMany.mockResolvedValue([
        { id: 'an-1', title: 'A' },
        { id: 'an-2', title: 'B' },
      ]);
      prisma.announcementRead.findMany.mockResolvedValue([
        { announcementId: 'an-1', userId: 'user-1' },
      ]);

      const result = await service.getAllForUser('user-1');

      expect(result).toEqual([
        { id: 'an-1', title: 'A', read: true },
        { id: 'an-2', title: 'B', read: false },
      ]);
    });
  });

  describe('markRead', () => {
    it('throws for an unknown announcement', async () => {
      prisma.announcement.findUnique.mockResolvedValue(null);
      await expect(service.markRead('user-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('upserts a read row idempotently', async () => {
      prisma.announcement.findUnique.mockResolvedValue({ id: 'an-1' });

      await service.markRead('user-1', 'an-1');

      expect(prisma.announcementRead.upsert).toHaveBeenCalledWith({
        where: {
          announcementId_userId: { announcementId: 'an-1', userId: 'user-1' },
        },
        create: { announcementId: 'an-1', userId: 'user-1' },
        update: {},
      });
    });
  });

  describe('publish', () => {
    it('creates an announcement with the actor as publisher', async () => {
      prisma.announcement.create.mockResolvedValue({
        id: 'an-1',
        title: 'Diwali holiday',
      });

      const result = await service.publish(
        { title: 'Diwali holiday', body: 'Office closed', category: 'HOLIDAY' },
        actor,
      );

      expect(prisma.announcement.create).toHaveBeenCalledWith({
        data: {
          title: 'Diwali holiday',
          body: 'Office closed',
          category: 'HOLIDAY',
          publishedByUserId: 'hr-1',
        },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ targetType: 'Announcement' }),
      );
      expect(result.id).toBe('an-1');
    });
  });
});
