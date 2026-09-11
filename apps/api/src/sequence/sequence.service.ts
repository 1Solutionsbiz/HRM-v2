import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Atomic per-key counters for human-facing codes (`Employee.employeeCode`,
 * and later `LeaveRequest.code` / `ExpenseClaim.code` / `Payslip.payslipNumber`)
 * — replaces the "SELECT max + 1" race the design doc explicitly calls out
 * as a legacy anti-pattern. Relies on `SequenceCounter.value`'s update being
 * a single atomic `UPDATE ... SET value = value + 1` at the SQL level, which
 * only holds if the row already exists — hence `next()` requires it to be
 * seeded ahead of time (`prisma/seed.ts`) rather than upserting, since an
 * upsert's create-vs-update branch is itself race-prone under concurrency.
 */
@Injectable()
export class SequenceService {
  constructor(private readonly prisma: PrismaService) {}

  async next(key: string): Promise<number> {
    try {
      const counter = await this.prisma.sequenceCounter.update({
        where: { key },
        data: { value: { increment: 1 } },
      });
      return counter.value;
    } catch {
      throw new InternalServerErrorException(
        `SequenceCounter "${key}" is not seeded — run the seed script before using this counter`,
      );
    }
  }

  /**
   * Like `next()`, but lazily creates the counter row on first use instead
   * of requiring it pre-seeded — for keys whose full set isn't known ahead
   * of time (letter document numbers are scoped per calendar year, e.g.
   * "letter:APT:2026", and a new year's key can't be pre-seeded). Race-safe
   * without upserting: the common path is the same atomic `UPDATE ... SET
   * value = value + 1` as `next()`; only a first-ever call for a given key
   * falls through to `create()`, and `key`'s primary-key constraint means
   * at most one concurrent `create()` can win — the loser retries the
   * `update()` and gets the correct next value instead of erroring.
   */
  async nextOrCreate(key: string): Promise<number> {
    try {
      const counter = await this.prisma.sequenceCounter.update({
        where: { key },
        data: { value: { increment: 1 } },
      });
      return counter.value;
    } catch {
      try {
        const counter = await this.prisma.sequenceCounter.create({
          data: { key, value: 1 },
        });
        return counter.value;
      } catch {
        const counter = await this.prisma.sequenceCounter.update({
          where: { key },
          data: { value: { increment: 1 } },
        });
        return counter.value;
      }
    }
  }
}
