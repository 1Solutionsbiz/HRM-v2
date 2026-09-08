import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { sumAmounts } from '../common/money.js';
import type { AuthContext } from '../common/auth-context.js';
import { OperatingExpenseCategory } from '../generated/prisma/enums.js';
import type { UpsertOperatingExpenseDto } from './dto/upsert-operating-expense.dto.js';

type DecimalLike = { toNumber(): number };

const STANDARD_CATEGORIES = Object.values(OperatingExpenseCategory).filter(
  (category) => category !== 'CUSTOM',
);

@Injectable()
export class OperatingExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * The 4 standard categories always come back, zero-filled if nothing was
   * entered yet — the reports screen renders one row per category
   * regardless of whether this period has been booked. CUSTOM rows are
   * returned separately since there can be any number of them (or none).
   */
  async getForPeriod(periodMonth?: number, periodYear?: number) {
    let month = periodMonth;
    let year = periodYear;
    if (month === undefined || year === undefined) {
      const now = new Date();
      month = now.getUTCMonth() + 1;
      year = now.getUTCFullYear();
    }

    const rows = await this.prisma.operatingExpense.findMany({
      where: { periodMonth: month, periodYear: year },
    });
    const byCategory = new Map(
      rows.filter((row) => row.category !== 'CUSTOM').map((row) => [row.category, row]),
    );

    const entries = STANDARD_CATEGORIES.map((category) => {
      const row = byCategory.get(category);
      return {
        category,
        amount: row ? row.amount.toNumber() : 0,
        note: row?.note ?? null,
        updatedAt: row?.updatedAt ?? null,
      };
    });

    const custom = rows
      .filter((row) => row.category === 'CUSTOM')
      .map((row) => ({
        id: row.id,
        label: row.label,
        amount: row.amount.toNumber(),
        note: row.note,
        updatedAt: row.updatedAt,
      }));

    return {
      periodMonth: month,
      periodYear: year,
      entries,
      custom,
      total: sumAmounts([...entries.map((e) => e.amount), ...custom.map((c) => c.amount)]),
    };
  }

  async upsert(dto: UpsertOperatingExpenseDto, actor: AuthContext) {
    // Ignored for the 4 standard categories, which are always one row per
    // period regardless of what's sent — only CUSTOM rows are distinguished
    // by label, so a stray label there would just fork a duplicate row.
    const label = dto.category === 'CUSTOM' ? dto.label!.trim() : '';

    const row = await this.prisma.operatingExpense.upsert({
      where: {
        category_label_periodMonth_periodYear: {
          category: dto.category,
          label,
          periodMonth: dto.periodMonth,
          periodYear: dto.periodYear,
        },
      },
      create: {
        category: dto.category,
        label,
        periodMonth: dto.periodMonth,
        periodYear: dto.periodYear,
        amount: dto.amount,
        note: dto.note ?? null,
      },
      update: {
        amount: dto.amount,
        note: dto.note ?? null,
      },
    });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'OperatingExpense',
      targetId: row.id,
      description: `Set ${dto.category}${label ? ` "${label}"` : ''} for ${dto.periodMonth}/${dto.periodYear} to ₹${dto.amount}`,
    });

    return this.serialize(row);
  }

  async remove(id: string, actor: AuthContext) {
    const row = await this.prisma.operatingExpense.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Operating expense entry not found');
    if (row.category !== 'CUSTOM') {
      throw new BadRequestException(
        'Only custom expense entries can be removed — the 4 standard categories can be zeroed out instead',
      );
    }

    await this.prisma.operatingExpense.delete({ where: { id } });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'OperatingExpense',
      targetId: id,
      description: `Removed custom expense "${row.label}" for ${row.periodMonth}/${row.periodYear}`,
    });
  }

  private serialize<T extends { amount: DecimalLike }>(row: T) {
    return { ...row, amount: row.amount.toNumber() };
  }
}
