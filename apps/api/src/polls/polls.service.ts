import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext } from '../common/auth-context.js';
import type { CreatePollDto } from './dto/create-poll.dto.js';
import type { VotePollDto } from './dto/vote-poll.dto.js';

@Injectable()
export class PollsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreatePollDto, actor: AuthContext) {
    const endsAt = new Date(dto.endsAt);
    if (Number.isNaN(endsAt.getTime()) || endsAt <= new Date()) {
      throw new BadRequestException(
        'endsAt must be a valid date/time in the future',
      );
    }

    const poll = await this.prisma.poll.create({
      data: {
        question: dto.question,
        endsAt,
        createdByUserId: actor.userId,
        options: {
          create: dto.options.map((label, index) => ({
            label,
            sortOrder: index,
          })),
        },
      },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Poll',
      targetId: poll.id,
      description: `Created poll "${dto.question}", closes ${dto.endsAt}`,
    });

    return poll;
  }

  /**
   * Every poll, oldest-vote-hidden-until-closed. `results` is null while
   * `isOpen` - the employee-facing rule requested directly: nobody sees
   * tallies (not even how many people have voted) until the poll's own
   * `endsAt` has passed. There's no separate admin "peek early" path.
   */
  async getForEmployee(userId: string) {
    const employeeId = await this.requireEmployeeId(userId);
    const now = new Date();

    const polls = await this.prisma.poll.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        options: {
          orderBy: { sortOrder: 'asc' },
          include: { _count: { select: { votes: true } } },
        },
        votes: { where: { employeeId }, select: { optionId: true } },
      },
    });

    return polls.map((poll) => {
      const isOpen = poll.endsAt > now;
      const myOptionId = poll.votes[0]?.optionId ?? null;
      const totalVotes = poll.options.reduce(
        (sum, o) => sum + o._count.votes,
        0,
      );

      return {
        id: poll.id,
        question: poll.question,
        createdAt: poll.createdAt,
        endsAt: poll.endsAt,
        isOpen,
        hasVoted: myOptionId !== null,
        myOptionId,
        options: poll.options.map((o) => ({ id: o.id, label: o.label })),
        results: isOpen
          ? null
          : {
              totalVotes,
              options: poll.options.map((o) => ({
                id: o.id,
                label: o.label,
                count: o._count.votes,
                percentage:
                  totalVotes > 0
                    ? Math.round((o._count.votes / totalVotes) * 1000) / 10
                    : 0,
              })),
            },
      };
    });
  }

  /**
   * One vote per employee per poll, permanently - requested directly
   * (2026-09-09), overriding the earlier "change your mind while open"
   * behavior the PollVote schema comment used to describe. Rejects a
   * second vote outright rather than upserting.
   */
  async vote(pollId: string, dto: VotePollDto, actor: AuthContext) {
    const employeeId = await this.requireEmployeeId(actor.userId);

    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      include: { options: true },
    });
    if (!poll) throw new NotFoundException('Poll not found');
    if (poll.endsAt <= new Date()) {
      throw new BadRequestException('This poll has closed');
    }
    const option = poll.options.find((o) => o.id === dto.optionId);
    if (!option) {
      throw new BadRequestException('That option does not belong to this poll');
    }

    const existing = await this.prisma.pollVote.findUnique({
      where: { pollId_employeeId: { pollId, employeeId } },
    });
    if (existing) {
      throw new ConflictException('You have already voted on this poll');
    }

    await this.prisma.pollVote.create({
      data: { pollId, optionId: dto.optionId, employeeId },
    });

    return { voted: true };
  }

  /**
   * Hard delete, unlike most of this app's "cancel, never remove" entities
   * (leave requests, tickets) - a poll is closer to an announcement or a
   * one-off admin mistake than a record with its own approval history, and
   * PollOption/PollVote both cascade so nothing is left orphaned.
   */
  async remove(pollId: string, actor: AuthContext) {
    const poll = await this.prisma.poll.findUnique({ where: { id: pollId } });
    if (!poll) throw new NotFoundException('Poll not found');

    await this.prisma.poll.delete({ where: { id: pollId } });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Poll',
      targetId: pollId,
      description: `Deleted poll "${poll.question}"`,
    });
  }

  private async requireEmployeeId(userId: string): Promise<string> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException(
        'No employee profile is linked to this account',
      );
    }
    return employee.id;
  }
}
