import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { SequenceService } from '../sequence/sequence.service.js';
import { parseDateOnly } from '../common/date-only.js';
import { sumAmounts } from '../common/money.js';
import type { AuthContext } from '../common/auth-context.js';
import type { ReviseSalaryDto } from './dto/revise-salary.dto.js';
import type { CreatePayslipDto } from './dto/create-payslip.dto.js';

type DecimalLike = { toNumber(): number };

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly sequenceService: SequenceService,
  ) {}

  async getMySalary(userId: string) {
    const employeeId = await this.requireEmployeeId(userId);
    return this.getEmployeeSalary(employeeId);
  }

  async getEmployeeSalary(employeeId: string) {
    const [structure, revisions] = await Promise.all([
      this.prisma.salaryStructure.findUnique({ where: { employeeId } }),
      this.prisma.salaryRevision.findMany({
        where: { employeeId },
        orderBy: { effectiveDate: 'desc' },
      }),
    ]);
    return {
      structure: structure ? this.serializeStructure(structure) : null,
      revisions: revisions.map((revision) => this.serializeRevision(revision)),
    };
  }

  async getCompanySalaries() {
    const structures = await this.prisma.salaryStructure.findMany({
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            departmentId: true,
          },
        },
      },
    });
    return structures.map((structure) => this.serializeStructure(structure));
  }

  /**
   * Records a new salary amount and its history — never a computed
   * breakdown (no basic/HRA/PF formula exists to compute from; see
   * CreatePayslipDto). `previousAmount` must be read from the structure
   * row that this same call updates: reading it outside the transaction
   * risks a revision whose `previousAmount` doesn't match what the
   * structure actually said, which corrupts the audit trail — the one
   * place in this codebase a partial write is worse than a failed one.
   */
  async reviseSalary(
    employeeId: string,
    dto: ReviseSalaryDto,
    actor: AuthContext,
  ) {
    await this.requireEmployee(employeeId);
    const effectiveDate = parseDateOnly(dto.effectiveDate);

    const { structure, revision } = await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.salaryStructure.findUnique({
          where: { employeeId },
        });
        const previousAmount = existing
          ? existing.currentAmount.toNumber()
          : null;

        const structure = existing
          ? await tx.salaryStructure.update({
              where: { employeeId },
              data: {
                currentAmount: dto.newAmount,
                lastRevisedAt: effectiveDate,
              },
            })
          : await tx.salaryStructure.create({
              data: {
                employeeId,
                currentAmount: dto.newAmount,
                lastRevisedAt: effectiveDate,
              },
            });

        const revision = await tx.salaryRevision.create({
          data: {
            employeeId,
            previousAmount,
            newAmount: dto.newAmount,
            effectiveDate,
            revisedByUserId: actor.userId,
            reason: dto.reason ?? null,
          },
        });

        return { structure, revision };
      },
    );

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Employee',
      targetId: employeeId,
      description: `Revised salary to ${dto.newAmount}, effective ${dto.effectiveDate}`,
    });

    return {
      structure: this.serializeStructure(structure),
      revision: this.serializeRevision(revision),
    };
  }

  async getMyPayslips(userId: string) {
    const employeeId = await this.requireEmployeeId(userId);
    return this.getEmployeePayslips(employeeId);
  }

  async getMyPayslip(userId: string, payslipId: string) {
    const employeeId = await this.requireEmployeeId(userId);
    const payslip = await this.prisma.payslip.findUnique({
      where: { id: payslipId },
      include: { lineItems: true },
    });
    // NotFoundException rather than ForbiddenException — don't reveal that a
    // payslip with this id exists for someone else.
    if (!payslip || payslip.employeeId !== employeeId) {
      throw new NotFoundException('Payslip not found');
    }
    return this.serializePayslip(payslip);
  }

  async getEmployeePayslips(employeeId: string) {
    const payslips = await this.prisma.payslip.findMany({
      where: { employeeId },
      include: { lineItems: true },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    });
    return payslips.map((payslip) => this.serializePayslip(payslip));
  }

  async generatePayslip(
    employeeId: string,
    dto: CreatePayslipDto,
    actor: AuthContext,
  ) {
    await this.requireEmployee(employeeId);

    const existing = await this.prisma.payslip.findFirst({
      where: {
        employeeId,
        periodMonth: dto.periodMonth,
        periodYear: dto.periodYear,
      },
    });
    if (existing) {
      throw new ConflictException(
        'A payslip for this employee and period already exists',
      );
    }

    const grossAmount = sumAmounts(
      dto.lineItems
        .filter((item) => item.type === 'EARNING')
        .map((item) => item.amount),
    );
    const deductions = sumAmounts(
      dto.lineItems
        .filter((item) => item.type === 'DEDUCTION')
        .map((item) => item.amount),
    );
    const netAmount = sumAmounts([grossAmount, -deductions]);

    const sequence = await this.sequenceService.next('payslipCode');
    // Format is a documented guess (schema comment on `payslipNumber` flags
    // it as unconfirmed) — year embedded for readability only, the
    // underlying counter is global and never resets.
    const payslipNumber = `PS-${dto.periodYear}-${String(sequence).padStart(5, '0')}`;

    const payslip = await this.prisma.$transaction(async (tx) => {
      const payslip = await tx.payslip.create({
        data: {
          payslipNumber,
          employeeId,
          periodMonth: dto.periodMonth,
          periodYear: dto.periodYear,
          grossAmount,
          netAmount,
          generatedByUserId: actor.userId,
        },
      });

      for (const [index, item] of dto.lineItems.entries()) {
        await tx.payslipLineItem.create({
          data: {
            payslipId: payslip.id,
            type: item.type,
            label: item.label,
            amount: item.amount,
            sortOrder: index,
          },
        });
      }

      return tx.payslip.findUniqueOrThrow({
        where: { id: payslip.id },
        include: { lineItems: true },
      });
    });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Employee',
      targetId: employeeId,
      description: `Generated payslip ${payslipNumber} for ${dto.periodMonth}/${dto.periodYear}`,
    });

    return this.serializePayslip(payslip);
  }

  async markPayslipPaid(payslipId: string, actor: AuthContext) {
    const payslip = await this.prisma.payslip.findUnique({
      where: { id: payslipId },
      include: { lineItems: true },
    });
    if (!payslip) throw new NotFoundException('Payslip not found');
    if (payslip.status === 'PAID') {
      throw new ConflictException('This payslip is already marked as paid');
    }

    const updated = await this.prisma.payslip.update({
      where: { id: payslipId },
      data: { status: 'PAID', paidAt: new Date() },
      include: { lineItems: true },
    });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Employee',
      targetId: payslip.employeeId,
      description: `Marked payslip ${payslip.payslipNumber} as paid`,
    });

    return this.serializePayslip(updated);
  }

  /**
   * Cost per month across all generated payslips — the only headcount
   * figure computable from real data is "employees with a payslip that
   * month," which is why the field is named `payslipCount`, not
   * `headcount` (it undercounts anyone hired mid-month or missing a
   * payslip for that period).
   */
  async getTrend() {
    const payslips = await this.prisma.payslip.findMany({
      select: {
        periodMonth: true,
        periodYear: true,
        grossAmount: true,
        employeeId: true,
      },
    });

    const byPeriod = new Map<
      string,
      {
        periodMonth: number;
        periodYear: number;
        amounts: number[];
        employeeIds: Set<string>;
      }
    >();
    for (const payslip of payslips) {
      const key = `${payslip.periodYear}-${payslip.periodMonth}`;
      const bucket = byPeriod.get(key) ?? {
        periodMonth: payslip.periodMonth,
        periodYear: payslip.periodYear,
        amounts: [],
        employeeIds: new Set<string>(),
      };
      bucket.amounts.push(payslip.grossAmount.toNumber());
      bucket.employeeIds.add(payslip.employeeId);
      byPeriod.set(key, bucket);
    }

    return [...byPeriod.values()]
      .map((bucket) => ({
        periodMonth: bucket.periodMonth,
        periodYear: bucket.periodYear,
        cost: sumAmounts(bucket.amounts),
        payslipCount: bucket.employeeIds.size,
      }))
      .sort((a, b) =>
        a.periodYear === b.periodYear
          ? a.periodMonth - b.periodMonth
          : a.periodYear - b.periodYear,
      );
  }

  /**
   * Same undercounting caveat as `getTrend` — `employeeCount` reflects who
   * has a payslip for the period, not everyone on the books.
   */
  async getByDepartment(periodMonth?: number, periodYear?: number) {
    let month = periodMonth;
    let year = periodYear;
    if (month === undefined || year === undefined) {
      const latest = await this.prisma.payslip.findFirst({
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
        select: { periodMonth: true, periodYear: true },
      });
      if (!latest) return [];
      month = latest.periodMonth;
      year = latest.periodYear;
    }

    const payslips = await this.prisma.payslip.findMany({
      where: { periodMonth: month, periodYear: year },
      include: { employee: { select: { departmentId: true } } },
    });

    const byDepartment = new Map<
      string | null,
      { amounts: number[]; employeeIds: Set<string> }
    >();
    for (const payslip of payslips) {
      const departmentId = payslip.employee?.departmentId ?? null;
      const bucket = byDepartment.get(departmentId) ?? {
        amounts: [],
        employeeIds: new Set<string>(),
      };
      bucket.amounts.push(payslip.grossAmount.toNumber());
      bucket.employeeIds.add(payslip.employeeId);
      byDepartment.set(departmentId, bucket);
    }

    return [...byDepartment.entries()].map(([departmentId, bucket]) => ({
      departmentId,
      cost: sumAmounts(bucket.amounts),
      employeeCount: bucket.employeeIds.size,
    }));
  }

  private serializeStructure<
    T extends {
      currentAmount: DecimalLike;
      employee?: {
        id: string;
        firstName: string;
        lastName: string;
        departmentId: string | null;
      };
    },
  >(structure: T) {
    return { ...structure, currentAmount: structure.currentAmount.toNumber() };
  }

  private serializeRevision<
    T extends { previousAmount: DecimalLike | null; newAmount: DecimalLike },
  >(revision: T) {
    return {
      ...revision,
      previousAmount: revision.previousAmount
        ? revision.previousAmount.toNumber()
        : null,
      newAmount: revision.newAmount.toNumber(),
    };
  }

  private serializePayslip<
    T extends {
      grossAmount: DecimalLike;
      netAmount: DecimalLike;
      lineItems: { amount: DecimalLike }[];
    },
  >(payslip: T) {
    return {
      ...payslip,
      grossAmount: payslip.grossAmount.toNumber(),
      netAmount: payslip.netAmount.toNumber(),
      lineItems: payslip.lineItems.map((item) => ({
        ...item,
        amount: item.amount.toNumber(),
      })),
    };
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

  private async requireEmployee(employeeId: string): Promise<void> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
  }
}
