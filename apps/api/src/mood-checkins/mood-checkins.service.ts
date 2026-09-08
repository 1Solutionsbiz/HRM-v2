import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { toDateOnly, formatDateOnly } from '../common/date-only.js';
import type { SubmitMoodCheckInDto } from './dto/submit-mood-checkin.dto.js';

type MoodCheckInRow = {
  id: string;
  date: Date;
  mood: string | null;
  tags: unknown;
  comment: string | null;
  isAnonymous: boolean;
  createdAt: Date;
};

@Injectable()
export class MoodCheckInsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(userId: string) {
    const employeeId = await this.requireEmployeeId(userId);
    const today = toDateOnly(new Date());
    const existing = await this.prisma.moodCheckIn.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });
    return { handledToday: !!existing };
  }

  /**
   * Upserts today's row rather than always creating one: a stray double
   * submit (double-click, retry) updates the same day's answer instead of
   * violating the one-row-per-day unique constraint.
   */
  async submit(userId: string, dto: SubmitMoodCheckInDto) {
    const employeeId = await this.requireEmployeeId(userId);
    const today = toDateOnly(new Date());
    const data = {
      mood: dto.mood,
      tags: dto.tags ?? [],
      comment: dto.comment ?? null,
      isAnonymous: dto.isAnonymous ?? false,
    };
    const row = await this.prisma.moodCheckIn.upsert({
      where: { employeeId_date: { employeeId, date: today } },
      create: { employeeId, date: today, ...data },
      update: data,
    });
    return this.serialize(row);
  }

  /**
   * Records that today's popup was closed without an answer — a `mood:
   * null` row, same table, so getStatus still reports `handledToday` and
   * the popup doesn't reappear later the same day. If today is already
   * handled (a race with a real submission, or a repeat dismiss), this is
   * a no-op rather than overwriting a real answer with null.
   */
  async dismiss(userId: string) {
    const employeeId = await this.requireEmployeeId(userId);
    const today = toDateOnly(new Date());
    await this.prisma.moodCheckIn.upsert({
      where: { employeeId_date: { employeeId, date: today } },
      create: { employeeId, date: today, mood: null },
      update: {},
    });
    return { handledToday: true };
  }

  /** Only real answers — the null "dismissed" rows aren't feedback. */
  async getMine(userId: string) {
    const employeeId = await this.requireEmployeeId(userId);
    const rows = await this.prisma.moodCheckIn.findMany({
      where: { employeeId, mood: { not: null } },
      orderBy: { date: 'desc' },
    });
    return rows.map((row) => this.serialize(row));
  }

  private serialize(row: MoodCheckInRow) {
    return {
      id: row.id,
      date: formatDateOnly(row.date),
      mood: row.mood,
      tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
      comment: row.comment,
      isAnonymous: row.isAnonymous,
      createdAt: row.createdAt,
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
}
