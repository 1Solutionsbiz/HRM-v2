import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext } from '../common/auth-context.js';
import type { UpdateGoalProgressDto } from './dto/update-goal-progress.dto.js';
import type { CreateGoalDto } from './dto/create-goal.dto.js';
import type { CreateReviewDto } from './dto/create-review.dto.js';
import type { CreateRecognitionDto } from './dto/create-recognition.dto.js';

const REVIEWER_INCLUDE = {
  reviewedByUser: {
    select: { employee: { select: { firstName: true, lastName: true } } },
  },
  cycle: { select: { name: true } },
} as const;

@Injectable()
export class PerformanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  getCycles() {
    return this.prisma.performanceCycle.findMany({
      orderBy: { startDate: 'desc' },
    });
  }

  async getMyPerformance(userId: string) {
    const employeeId = await this.requireEmployeeId(userId);
    return this.buildRecord(employeeId);
  }

  async getEmployeePerformance(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return this.buildRecord(employeeId);
  }

  async updateMyGoalProgress(
    userId: string,
    goalId: string,
    dto: UpdateGoalProgressDto,
  ) {
    const employeeId = await this.requireEmployeeId(userId);
    const goal = await this.prisma.goal.findUnique({ where: { id: goalId } });
    if (!goal) throw new NotFoundException('Goal not found');
    if (goal.employeeId !== employeeId) {
      throw new ForbiddenException(
        'You can only update progress on your own goals',
      );
    }
    return this.prisma.goal.update({
      where: { id: goalId },
      data: { progressPercent: dto.progressPercent },
    });
  }

  async createGoal(employeeId: string, dto: CreateGoalDto, actor: AuthContext) {
    await this.requireEmployeeExists(employeeId);
    const cycle = await this.prisma.performanceCycle.findUnique({
      where: { id: dto.cycleId },
    });
    if (!cycle)
      throw new BadRequestException(
        'cycleId does not reference an existing performance cycle',
      );

    const goal = await this.prisma.goal.create({
      data: {
        employeeId,
        cycleId: dto.cycleId,
        title: dto.title,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Employee',
      targetId: employeeId,
      description: `Assigned goal: ${dto.title}`,
    });

    return goal;
  }

  async createReview(
    employeeId: string,
    dto: CreateReviewDto,
    actor: AuthContext,
  ) {
    await this.requireEmployeeExists(employeeId);
    const cycle = await this.prisma.performanceCycle.findUnique({
      where: { id: dto.cycleId },
    });
    if (!cycle)
      throw new BadRequestException(
        'cycleId does not reference an existing performance cycle',
      );

    const maxRating = dto.maxRating ?? 5;
    if (dto.rating > maxRating) {
      throw new BadRequestException(
        `rating cannot exceed maxRating (${maxRating})`,
      );
    }

    const review = await this.prisma.performanceReview.create({
      data: {
        employeeId,
        cycleId: dto.cycleId,
        rating: dto.rating,
        maxRating,
        summary: dto.summary,
        reviewedByUserId: actor.userId,
      },
    });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Employee',
      targetId: employeeId,
      description: `Conducted performance review for cycle ${cycle.name}: ${dto.rating}/${maxRating}`,
    });

    return this.serializeReview(review);
  }

  async createRecognition(
    employeeId: string,
    dto: CreateRecognitionDto,
    actor: AuthContext,
  ) {
    await this.requireEmployeeExists(employeeId);

    const recognition = await this.prisma.recognition.create({
      data: { employeeId, title: dto.title, source: dto.source },
    });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Employee',
      targetId: employeeId,
      description: `Awarded recognition: ${dto.title}`,
    });

    return recognition;
  }

  private async buildRecord(employeeId: string) {
    const activeCycle = await this.prisma.performanceCycle.findFirst({
      where: { isActive: true },
      orderBy: { startDate: 'desc' },
    });

    const [goals, lastReview, recognitions] = await Promise.all([
      activeCycle
        ? this.prisma.goal.findMany({
            where: { employeeId, cycleId: activeCycle.id },
            orderBy: { dueDate: 'asc' },
          })
        : Promise.resolve([]),
      this.prisma.performanceReview.findFirst({
        where: { employeeId },
        orderBy: { reviewedAt: 'desc' },
        include: REVIEWER_INCLUDE,
      }),
      this.prisma.recognition.findMany({
        where: { employeeId },
        orderBy: { awardedAt: 'desc' },
      }),
    ]);

    return {
      cycle: activeCycle,
      goals,
      lastReview: lastReview ? this.serializeReview(lastReview) : null,
      recognitions,
    };
  }

  /** `PerformanceReview.rating` is a Decimal; convert to a number at the response boundary, same lesson as Leave/Expenses. */
  private serializeReview<T extends { rating: { toNumber(): number } }>(
    review: T,
  ) {
    return { ...review, rating: review.rating.toNumber() };
  }

  private async requireEmployeeExists(employeeId: string): Promise<void> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
  }

  private async requireEmployeeId(userId: string): Promise<string> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!employee)
      throw new NotFoundException(
        'No employee profile is linked to this account',
      );
    return employee.id;
  }
}
