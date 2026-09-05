import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PerformanceService } from './performance.service.js';
import type { AuthContext } from '../common/auth-context.js';

function decimal(value: number) {
  return { toNumber: () => value };
}

function buildPrismaMock() {
  return {
    employee: { findUnique: vi.fn() },
    performanceCycle: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    goal: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    performanceReview: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    },
    recognition: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn() },
  };
}

const actor: AuthContext = {
  userId: 'hr-1',
  sessionId: 's1',
  email: 'hr@example.com',
  roles: ['hr'],
  permissions: ['performance:manage'],
};

describe('PerformanceService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let auditService: { log: ReturnType<typeof vi.fn> };
  let service: PerformanceService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
    auditService = { log: vi.fn().mockResolvedValue(undefined) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new PerformanceService(prisma as any, auditService as any);
  });

  describe('getMyPerformance', () => {
    it('returns empty goals and null lastReview with no active cycle or history', async () => {
      prisma.performanceCycle.findFirst.mockResolvedValue(null);

      const result = await service.getMyPerformance('user-1');

      expect(result).toEqual({
        cycle: null,
        goals: [],
        lastReview: null,
        recognitions: [],
      });
    });

    it('converts the review rating to a plain number', async () => {
      prisma.performanceCycle.findFirst.mockResolvedValue({
        id: 'cyc-1',
        name: 'H2 2026',
      });
      prisma.performanceReview.findFirst.mockResolvedValue({
        id: 'rev-1',
        rating: decimal(4.2),
        maxRating: 5,
      });

      const result = await service.getMyPerformance('user-1');

      expect(result.lastReview?.rating).toBe(4.2);
    });
  });

  describe('updateMyGoalProgress', () => {
    it('throws for a nonexistent goal', async () => {
      prisma.goal.findUnique.mockResolvedValue(null);
      await expect(
        service.updateMyGoalProgress('user-1', 'missing', {
          progressPercent: 50,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects updating another employee goal', async () => {
      prisma.goal.findUnique.mockResolvedValue({
        id: 'g1',
        employeeId: 'someone-else',
      });
      await expect(
        service.updateMyGoalProgress('user-1', 'g1', { progressPercent: 50 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('updates progress on the caller own goal', async () => {
      prisma.goal.findUnique.mockResolvedValue({
        id: 'g1',
        employeeId: 'emp-1',
      });
      prisma.goal.update.mockResolvedValue({ id: 'g1', progressPercent: 75 });

      const result = await service.updateMyGoalProgress('user-1', 'g1', {
        progressPercent: 75,
      });

      expect(prisma.goal.update).toHaveBeenCalledWith({
        where: { id: 'g1' },
        data: { progressPercent: 75 },
      });
      expect(result.progressPercent).toBe(75);
    });
  });

  describe('createReview', () => {
    it('rejects an unknown cycle', async () => {
      prisma.performanceCycle.findUnique.mockResolvedValue(null);
      await expect(
        service.createReview(
          'emp-1',
          { cycleId: 'missing', rating: 4, summary: 'x' },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a rating above maxRating', async () => {
      prisma.performanceCycle.findUnique.mockResolvedValue({
        id: 'cyc-1',
        name: 'H2 2026',
      });
      await expect(
        service.createReview(
          'emp-1',
          { cycleId: 'cyc-1', rating: 6, maxRating: 5, summary: 'x' },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a review within range and serializes the rating', async () => {
      prisma.performanceCycle.findUnique.mockResolvedValue({
        id: 'cyc-1',
        name: 'H2 2026',
      });
      prisma.performanceReview.create.mockResolvedValue({
        id: 'rev-1',
        rating: decimal(4.5),
        maxRating: 5,
      });

      const result = await service.createReview(
        'emp-1',
        { cycleId: 'cyc-1', rating: 4.5, summary: 'Great work' },
        actor,
      );

      expect(prisma.performanceReview.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reviewedByUserId: 'hr-1' }),
        }),
      );
      expect(result.rating).toBe(4.5);
    });
  });

  describe('createGoal', () => {
    it('throws for an unknown employee', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      await expect(
        service.createGoal('missing', { cycleId: 'cyc-1', title: 'x' }, actor),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an unknown cycle', async () => {
      prisma.performanceCycle.findUnique.mockResolvedValue(null);
      await expect(
        service.createGoal('emp-1', { cycleId: 'missing', title: 'x' }, actor),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
