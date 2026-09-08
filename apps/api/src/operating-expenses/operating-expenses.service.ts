import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { sumAmounts } from '../common/money.js';
import type { AuthContext } from '../common/auth-context.js';
import { OperatingExpenseCategory } from '../generated/prisma/enums.js';
import type { UpsertOperatingExpenseDto } from './dto/upsert-operating-expense.dto.js';

type DecimalLike = { toNumber(): number };

const CATEGORIES = Object.values(OperatingExpenseCategory);

@Injectable()
export class OperatingExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Every category is always returned, zero-filled if nothing was entered
   * yet — the reports screen renders one row per category regardless of
   * whether this period has been booked.
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
    const byCategory = new Map(rows.map((row) => [row.category, row]));

    const entries = CATEGORIES.map((category) => {
      const row = byCategory.get(category);
      return {
        category,
        amount: row ? row.amount.toNumber() : 0,
        note: row?.note ?? null,
        updatedAt: row?.updatedAt ?? null,
      };
    });

    return {
      periodMonth: month,
      periodYear: year,
      entries,
      total: sumAmounts(entries.map((entry) => entry.amount)),
    };
  }

  async upsert(dto: UpsertOperatingExpenseDto, actor: AuthContext) {
    const row = await this.prisma.operatingExpense.upsert({
      where: {
        category_periodMonth_periodYear: {
          category: dto.category,
          periodMonth: dto.periodMonth,
          periodYear: dto.periodYear,
        },
      },
      create: {
        category: dto.category,
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
      description: `Set ${dto.category} for ${dto.periodMonth}/${dto.periodYear} to ₹${dto.amount}`,
    });

    return this.serialize(row);
  }

  private serialize<T extends { amount: DecimalLike }>(row: T) {
    return { ...row, amount: row.amount.toNumber() };
  }
}
