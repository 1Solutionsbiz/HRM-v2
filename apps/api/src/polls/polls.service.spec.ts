import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PollsService } from './polls.service.js';
import type { AuthContext } from '../common/auth-context.js';

function buildPrismaMock() {
  return {
    employee: { findUnique: vi.fn() },
    poll: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    pollVote: { upsert: vi.fn() },
  };
}

const actor: AuthContext = {
  userId: 'hr-1',
  sessionId: 's1',
  email: 'hr@example.com',
  roles: ['hr'],
  permissions: ['poll:manage'],
};

describe('PollsService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let auditService: { log: ReturnType<typeof vi.fn> };
  let service: PollsService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
    auditService = { log: vi.fn().mockResolvedValue(undefined) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new PollsService(prisma as any, auditService as any);
  });

  describe('create', () => {
    it('rejects an endsAt that is not in the future', async () => {
      await expect(
        service.create(
          { question: 'Q', endsAt: '2020-01-01T00:00:00.000Z', options: ['A', 'B'] },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.poll.create).not.toHaveBeenCalled();
    });

    it('creates the poll with ordered options and audit-logs it', async () => {
      const endsAt = new Date(Date.now() + 86_400_000).toISOString();
      prisma.poll.create.mockResolvedValue({ id: 'poll-1', question: 'Q', options: [] });

      await service.create({ question: 'Q', endsAt, options: ['A', 'B', 'C'] }, actor);

      expect(prisma.poll.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            question: 'Q',
            createdByUserId: 'hr-1',
            options: {
              create: [
                { label: 'A', sortOrder: 0 },
                { label: 'B', sortOrder: 1 },
                { label: 'C', sortOrder: 2 },
              ],
            },
          }),
        }),
      );
      expect(auditService.log).toHaveBeenCalled();
    });
  });

  describe('getForEmployee', () => {
    it('hides results while open but reports whether I voted', async () => {
      const future = new Date(Date.now() + 86_400_000);
      prisma.poll.findMany.mockResolvedValue([
        {
          id: 'poll-1',
          question: 'Q',
          createdAt: new Date(),
          endsAt: future,
          options: [
            { id: 'opt-1', label: 'A', _count: { votes: 3 } },
            { id: 'opt-2', label: 'B', _count: { votes: 1 } },
          ],
          votes: [{ optionId: 'opt-1' }],
        },
      ]);

      const [result] = await service.getForEmployee('user-1');

      expect(result!.isOpen).toBe(true);
      expect(result!.hasVoted).toBe(true);
      expect(result!.myOptionId).toBe('opt-1');
      expect(result!.results).toBeNull();
    });

    it('shows aggregate results once closed', async () => {
      const past = new Date(Date.now() - 86_400_000);
      prisma.poll.findMany.mockResolvedValue([
        {
          id: 'poll-1',
          question: 'Q',
          createdAt: new Date(),
          endsAt: past,
          options: [
            { id: 'opt-1', label: 'A', _count: { votes: 3 } },
            { id: 'opt-2', label: 'B', _count: { votes: 1 } },
          ],
          votes: [],
        },
      ]);

      const [result] = await service.getForEmployee('user-1');

      expect(result!.isOpen).toBe(false);
      expect(result!.hasVoted).toBe(false);
      expect(result!.results).toEqual({
        totalVotes: 4,
        options: [
          { id: 'opt-1', label: 'A', count: 3, percentage: 75 },
          { id: 'opt-2', label: 'B', count: 1, percentage: 25 },
        ],
      });
    });
  });

  describe('vote', () => {
    it('throws when the poll has already closed', async () => {
      prisma.poll.findUnique.mockResolvedValue({
        id: 'poll-1',
        endsAt: new Date(Date.now() - 1000),
        options: [{ id: 'opt-1' }],
      });

      await expect(service.vote('poll-1', { optionId: 'opt-1' }, actor)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.pollVote.upsert).not.toHaveBeenCalled();
    });

    it('throws when the option does not belong to the poll', async () => {
      prisma.poll.findUnique.mockResolvedValue({
        id: 'poll-1',
        endsAt: new Date(Date.now() + 86_400_000),
        options: [{ id: 'opt-1' }],
      });

      await expect(service.vote('poll-1', { optionId: 'not-real' }, actor)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when the poll does not exist', async () => {
      prisma.poll.findUnique.mockResolvedValue(null);
      await expect(service.vote('missing', { optionId: 'opt-1' }, actor)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('upserts the vote for a valid option on an open poll', async () => {
      prisma.poll.findUnique.mockResolvedValue({
        id: 'poll-1',
        endsAt: new Date(Date.now() + 86_400_000),
        options: [{ id: 'opt-1' }, { id: 'opt-2' }],
      });
      prisma.pollVote.upsert.mockResolvedValue({});

      const result = await service.vote('poll-1', { optionId: 'opt-2' }, actor);

      expect(prisma.pollVote.upsert).toHaveBeenCalledWith({
        where: { pollId_employeeId: { pollId: 'poll-1', employeeId: 'emp-1' } },
        create: { pollId: 'poll-1', optionId: 'opt-2', employeeId: 'emp-1' },
        update: { optionId: 'opt-2', votedAt: expect.any(Date) },
      });
      expect(result).toEqual({ voted: true });
    });
  });

  describe('remove', () => {
    it('deletes the poll and audit-logs it', async () => {
      prisma.poll.findUnique.mockResolvedValue({ id: 'poll-1', question: 'Q' });

      await service.remove('poll-1', actor);

      expect(prisma.poll.delete).toHaveBeenCalledWith({ where: { id: 'poll-1' } });
      expect(auditService.log).toHaveBeenCalled();
    });

    it('throws when the poll does not exist', async () => {
      prisma.poll.findUnique.mockResolvedValue(null);
      await expect(service.remove('missing', actor)).rejects.toThrow(NotFoundException);
      expect(prisma.poll.delete).not.toHaveBeenCalled();
    });
  });
});
