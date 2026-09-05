import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { SequenceService } from '../sequence/sequence.service.js';
import { parseDateOnly } from '../common/date-only.js';
import type { AuthContext } from '../common/auth-context.js';
import type { SubmitExpenseClaimDto } from './dto/submit-expense-claim.dto.js';
import type { DecideExpenseClaimDto } from './dto/decide-expense-claim.dto.js';

const ACTIVE_CLAIM_STATUSES = ['PENDING', 'APPROVED'] as const;

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly sequenceService: SequenceService,
  ) {}

  getCategories() {
    return this.prisma.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async getMyClaims(userId: string) {
    const employeeId = await this.requireEmployeeId(userId);
    const claims = await this.prisma.expenseClaim.findMany({
      where: { employeeId },
      include: { category: { select: { name: true } } },
      orderBy: { submittedAt: 'desc' },
    });
    return claims.map((claim) => this.serializeClaim(claim));
  }

  async submitClaim(
    userId: string,
    dto: SubmitExpenseClaimDto,
    actor: AuthContext,
  ) {
    const employeeId = await this.requireEmployeeId(userId);

    const category = await this.prisma.expenseCategory.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category || !category.isActive) {
      throw new BadRequestException(
        'categoryId does not reference an active expense category',
      );
    }

    const expenseDate = parseDateOnly(dto.expenseDate);
    await this.assertWithinMonthlyCap(
      employeeId,
      category,
      expenseDate,
      dto.amount,
    );

    const sequence = await this.sequenceService.next('expenseClaimCode');
    const code = `EX-${String(sequence).padStart(4, '0')}`;

    const claim = await this.prisma.expenseClaim.create({
      data: {
        code,
        employeeId,
        categoryId: dto.categoryId,
        amount: dto.amount,
        expenseDate,
        description: dto.description,
        receiptUrl: dto.receiptUrl,
      },
    });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'ExpenseClaim',
      targetId: claim.id,
      description: `Submitted ${category.name} expense claim for ${dto.amount}`,
    });

    return this.serializeClaim(claim);
  }

  async cancelMyClaim(userId: string, claimId: string, actor: AuthContext) {
    const employeeId = await this.requireEmployeeId(userId);
    const claim = await this.prisma.expenseClaim.findUnique({
      where: { id: claimId },
    });
    if (!claim || claim.employeeId !== employeeId) {
      throw new NotFoundException('Expense claim not found');
    }
    if (claim.status !== 'PENDING') {
      throw new ConflictException(
        'Only a pending expense claim can be cancelled',
      );
    }

    const updated = await this.prisma.expenseClaim.update({
      where: { id: claimId },
      data: { status: 'CANCELLED' },
    });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'ExpenseClaim',
      targetId: claimId,
      description: 'Expense claim cancelled by employee',
    });

    return this.serializeClaim(updated);
  }

  async getCompanyClaims() {
    const claims = await this.prisma.expenseClaim.findMany({
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        category: { select: { name: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
    return claims.map((claim) => this.serializeClaim(claim));
  }

  async decide(
    claimId: string,
    dto: DecideExpenseClaimDto,
    actor: AuthContext,
  ) {
    const claim = await this.prisma.expenseClaim.findUnique({
      where: { id: claimId },
    });
    if (!claim) throw new NotFoundException('Expense claim not found');
    if (claim.status !== 'PENDING') {
      throw new ConflictException(
        'This expense claim has already been decided or cancelled',
      );
    }

    const updated = await this.prisma.expenseClaim.update({
      where: { id: claimId },
      data: {
        status: dto.decision,
        approverUserId: actor.userId,
        decidedAt: new Date(),
        decisionNote: dto.decisionNote,
      },
    });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'ExpenseClaim',
      targetId: claimId,
      description: `Expense claim ${claim.code} ${dto.decision.toLowerCase()}`,
    });

    return this.serializeClaim(updated);
  }

  /**
   * `ExpenseCategory.monthlyCapAmount` makes a legacy hardcoded rule ("₹5,000/mo
   * internet cap", per the schema comment) an actual enforced, editable
   * value — categories without a cap skip this entirely. Computed live from
   * PENDING+APPROVED claims that month, same reasoning as Leave's balance
   * check: catches double-booking across multiple pending claims without a
   * reserve/release step.
   */
  private async assertWithinMonthlyCap(
    employeeId: string,
    category: { id: string; monthlyCapAmount: { toNumber(): number } | null },
    expenseDate: Date,
    newAmount: number,
  ): Promise<void> {
    if (!category.monthlyCapAmount) return;

    const cap = category.monthlyCapAmount.toNumber();
    const monthStart = new Date(
      Date.UTC(expenseDate.getUTCFullYear(), expenseDate.getUTCMonth(), 1),
    );
    const monthEnd = new Date(
      Date.UTC(expenseDate.getUTCFullYear(), expenseDate.getUTCMonth() + 1, 0),
    );

    const claims = await this.prisma.expenseClaim.findMany({
      where: {
        employeeId,
        categoryId: category.id,
        status: { in: [...ACTIVE_CLAIM_STATUSES] },
        expenseDate: { gte: monthStart, lte: monthEnd },
      },
    });
    const committed = claims.reduce(
      (sum, claim) => sum + claim.amount.toNumber(),
      0,
    );

    if (committed + newAmount > cap) {
      const remaining = Math.max(0, cap - committed);
      throw new BadRequestException(
        `This exceeds the monthly cap for this category (${remaining} remaining this month)`,
      );
    }
  }

  /** `ExpenseClaim.amount` is a Decimal; decimal.js's toJSON() serializes as a string — convert to a number, same fix as Leave's totalDays. */
  private serializeClaim<T extends { amount: { toNumber(): number } }>(
    claim: T,
  ) {
    return { ...claim, amount: claim.amount.toNumber() };
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
