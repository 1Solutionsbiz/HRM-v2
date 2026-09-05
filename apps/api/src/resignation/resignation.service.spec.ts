import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ResignationService } from './resignation.service.js';
import type { AuthContext } from '../common/auth-context.js';

function buildPrismaMock() {
  return {
    employee: { findUnique: vi.fn() },
    resignation: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

const actor: AuthContext = {
  userId: 'hr-1',
  sessionId: 's1',
  email: 'hr@example.com',
  roles: ['hr'],
  permissions: ['resignation:decide'],
};

describe('ResignationService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let auditService: { log: ReturnType<typeof vi.fn> };
  let service: ResignationService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
    auditService = { log: vi.fn().mockResolvedValue(undefined) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new ResignationService(prisma as any, auditService as any);
  });

  describe('submit', () => {
    it('rejects a second submission while one is already pending', async () => {
      prisma.resignation.findFirst.mockResolvedValue({
        id: 'r1',
        status: 'PENDING',
      });
      await expect(
        service.submit(
          'user-1',
          { reason: 'x', lastWorkingDay: '2099-01-01' },
          actor,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects a lastWorkingDay in the past', async () => {
      await expect(
        service.submit(
          'user-1',
          { reason: 'x', lastWorkingDay: '2000-01-01' },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('derives noticePeriodDays from the date range rather than trusting client input', async () => {
      prisma.resignation.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'r1', ...data }),
      );
      const future = new Date();
      future.setUTCDate(future.getUTCDate() + 30);
      const lastWorkingDay = future.toISOString().slice(0, 10);

      const result = await service.submit(
        'user-1',
        { reason: 'Relocating', lastWorkingDay },
        actor,
      );

      expect(result.noticePeriodDays).toBeGreaterThanOrEqual(29);
      expect(result.noticePeriodDays).toBeLessThanOrEqual(30);
    });
  });

  describe('cancelMine', () => {
    it('throws for a resignation owned by someone else', async () => {
      prisma.resignation.findUnique.mockResolvedValue({
        id: 'r1',
        employeeId: 'someone-else',
        status: 'PENDING',
      });
      await expect(service.cancelMine('user-1', 'r1', actor)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects withdrawing an already-decided resignation', async () => {
      prisma.resignation.findUnique.mockResolvedValue({
        id: 'r1',
        employeeId: 'emp-1',
        status: 'APPROVED',
      });
      await expect(service.cancelMine('user-1', 'r1', actor)).rejects.toThrow(
        ConflictException,
      );
    });

    it('sets status to WITHDRAWN rather than deleting the row', async () => {
      prisma.resignation.findUnique.mockResolvedValue({
        id: 'r1',
        employeeId: 'emp-1',
        status: 'PENDING',
      });
      prisma.resignation.update.mockResolvedValue({
        id: 'r1',
        status: 'WITHDRAWN',
      });

      const result = await service.cancelMine('user-1', 'r1', actor);

      expect(prisma.resignation.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: 'WITHDRAWN' },
      });
      expect(result.status).toBe('WITHDRAWN');
    });
  });

  describe('decide', () => {
    it('throws for an unknown resignation', async () => {
      prisma.resignation.findUnique.mockResolvedValue(null);
      await expect(
        service.decide('missing', { decision: 'APPROVED' }, actor),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects deciding an already-decided resignation', async () => {
      prisma.resignation.findUnique.mockResolvedValue({
        id: 'r1',
        employeeId: 'emp-1',
        status: 'DECLINED',
      });
      await expect(
        service.decide('r1', { decision: 'APPROVED' }, actor),
      ).rejects.toThrow(ConflictException);
    });

    it('approves a pending resignation', async () => {
      prisma.resignation.findUnique.mockResolvedValue({
        id: 'r1',
        employeeId: 'emp-1',
        status: 'PENDING',
      });
      prisma.resignation.update.mockResolvedValue({
        id: 'r1',
        status: 'APPROVED',
      });

      const result = await service.decide(
        'r1',
        { decision: 'APPROVED' },
        actor,
      );

      expect(prisma.resignation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'APPROVED',
            decidedByUserId: 'hr-1',
          }),
        }),
      );
      expect(result.status).toBe('APPROVED');
    });
  });
});
