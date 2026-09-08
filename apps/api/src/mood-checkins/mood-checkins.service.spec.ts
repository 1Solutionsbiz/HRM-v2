import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { MoodCheckInsService } from './mood-checkins.service.js';

function buildPrismaMock() {
  return {
    employee: { findUnique: vi.fn() },
    moodCheckIn: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

describe('MoodCheckInsService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: MoodCheckInsService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new MoodCheckInsService(prisma as any);
  });

  it('throws when the user has no linked employee profile', async () => {
    prisma.employee.findUnique.mockResolvedValue(null);
    await expect(service.getStatus('user-1')).rejects.toThrow(NotFoundException);
  });

  describe('getStatus', () => {
    it('reports handledToday true when a row exists for today, regardless of mood', async () => {
      prisma.moodCheckIn.findUnique.mockResolvedValue({ id: 'mc-1', mood: null });
      const result = await service.getStatus('user-1');
      expect(result).toEqual({ handledToday: true });
    });

    it('reports handledToday false when nothing exists yet', async () => {
      prisma.moodCheckIn.findUnique.mockResolvedValue(null);
      const result = await service.getStatus('user-1');
      expect(result).toEqual({ handledToday: false });
    });
  });

  describe('submit', () => {
    it('upserts today\'s row with the given mood/tags/comment', async () => {
      prisma.moodCheckIn.upsert.mockResolvedValue({
        id: 'mc-1',
        date: new Date('2026-09-08T00:00:00.000Z'),
        mood: 'GREAT',
        tags: ['Colleagues', 'Growth'],
        comment: 'Good day',
        isAnonymous: false,
        createdAt: new Date('2026-09-08T10:00:00.000Z'),
      });

      const result = await service.submit('user-1', {
        mood: 'GREAT',
        tags: ['Colleagues', 'Growth'],
        comment: 'Good day',
      });

      expect(prisma.moodCheckIn.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            employeeId: 'emp-1',
            mood: 'GREAT',
            tags: ['Colleagues', 'Growth'],
            comment: 'Good day',
            isAnonymous: false,
          }),
          update: expect.objectContaining({ mood: 'GREAT' }),
        }),
      );
      expect(result.date).toBe('2026-09-08');
      expect(result.tags).toEqual(['Colleagues', 'Growth']);
    });
  });

  describe('dismiss', () => {
    it('upserts a null-mood row for today and leaves an existing row alone on update', async () => {
      prisma.moodCheckIn.upsert.mockResolvedValue({});
      const result = await service.dismiss('user-1');

      expect(prisma.moodCheckIn.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ employeeId: 'emp-1', mood: null }),
          update: {},
        }),
      );
      expect(result).toEqual({ handledToday: true });
    });
  });

  describe('getMine', () => {
    it('only queries rows with a real mood, not dismissed days', async () => {
      await service.getMine('user-1');
      expect(prisma.moodCheckIn.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { employeeId: 'emp-1', mood: { not: null } } }),
      );
    });

    it('defaults tags to an empty array when null', async () => {
      prisma.moodCheckIn.findMany.mockResolvedValue([
        {
          id: 'mc-1',
          date: new Date('2026-09-01T00:00:00.000Z'),
          mood: 'GOOD',
          tags: null,
          comment: null,
          isAnonymous: false,
          createdAt: new Date('2026-09-01T09:00:00.000Z'),
        },
      ]);
      const [result] = await service.getMine('user-1');
      expect(result.tags).toEqual([]);
    });
  });
});
