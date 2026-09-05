import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext } from '../common/auth-context.js';
import {
  addDays,
  formatDateOnly,
  parseDateOnly,
  toDateOnly,
} from '../common/date-only.js';
import {
  AttendanceEventType,
  type AttendanceDayStatus,
} from '../generated/prisma/enums.js';
import type { RecordCorrectionDto } from './dto/record-correction.dto.js';
import type { GetHistoryQueryDto } from './dto/get-history-query.dto.js';

const DEFAULT_HISTORY_DAYS = 45;
const MAX_HISTORY_DAYS = 90;

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Derives "today" from the API process's own local clock — there is no
 * per-user timezone support, and this is a single-tenant system
 * (`CompanySettings.timezone`, default "Asia/Kolkata"). This is only
 * correct if the API host's system timezone is set to the company's. A
 * punch made close to local midnight on a misconfigured (e.g. UTC) host
 * would silently land on the wrong `AttendanceDay` — `@@unique([employeeId,
 * date])` means it would merge into the adjacent day's row rather than
 * erroring. This is a real deployment constraint, not just a code comment:
 * see PROJECT_STATUS.md.
 */
function companyToday(): Date {
  return toDateOnly(new Date());
}

type AttendanceEventRow = {
  id: string;
  type: AttendanceEventType;
  occurredAt: Date;
};

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async checkIn(actor: AuthContext, meta: RequestMeta) {
    const employeeId = await this.requireEmployeeId(actor.userId);
    const today = companyToday();

    let day = await this.prisma.attendanceDay.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });
    if (day) {
      const alreadyCheckedIn = await this.prisma.attendanceEvent.findFirst({
        where: { attendanceDayId: day.id, type: AttendanceEventType.CHECK_IN },
      });
      if (alreadyCheckedIn)
        throw new ConflictException('Already checked in today');
    } else {
      day = await this.prisma.attendanceDay.create({
        data: { employeeId, date: today },
      });
    }

    await this.prisma.attendanceEvent.create({
      data: {
        attendanceDayId: day.id,
        employeeId,
        type: AttendanceEventType.CHECK_IN,
        occurredAt: new Date(),
        source: 'WEB',
        recordedByUserId: actor.userId,
        ipAddress: meta.ipAddress,
      },
    });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'AttendanceDay',
      targetId: day.id,
      description: 'Checked in',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.serializeToday(await this.recomputeDay(day.id));
  }

  async checkOut(actor: AuthContext, meta: RequestMeta) {
    const employeeId = await this.requireEmployeeId(actor.userId);
    const today = companyToday();

    const day = await this.prisma.attendanceDay.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });
    if (!day)
      throw new ConflictException('Cannot check out before checking in');

    const events = await this.prisma.attendanceEvent.findMany({
      where: { attendanceDayId: day.id },
    });
    const hasCheckIn = events.some(
      (event) => event.type === AttendanceEventType.CHECK_IN,
    );
    const hasCheckOut = events.some(
      (event) => event.type === AttendanceEventType.CHECK_OUT,
    );
    if (!hasCheckIn)
      throw new ConflictException('Cannot check out before checking in');
    if (hasCheckOut)
      throw new ConflictException('Already checked out for today');

    await this.prisma.attendanceEvent.create({
      data: {
        attendanceDayId: day.id,
        employeeId,
        type: AttendanceEventType.CHECK_OUT,
        occurredAt: new Date(),
        source: 'WEB',
        recordedByUserId: actor.userId,
        ipAddress: meta.ipAddress,
      },
    });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'AttendanceDay',
      targetId: day.id,
      description: 'Checked out',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.serializeToday(await this.recomputeDay(day.id));
  }

  async getTodayForUser(userId: string) {
    const employeeId = await this.requireEmployeeId(userId);
    const today = companyToday();
    const day = await this.prisma.attendanceDay.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });
    if (!day) {
      return {
        date: formatDateOnly(today),
        punchState: 'NOT_CHECKED_IN',
        status: null,
        firstCheckInAt: null,
        lastCheckOutAt: null,
        workedMinutes: null,
        lateMinutes: 0,
      };
    }
    return this.serializeToday(day);
  }

  async getHistoryForUser(userId: string, query: GetHistoryQueryDto) {
    const employeeId = await this.requireEmployeeId(userId);
    const today = companyToday();
    const to = query.to ? parseDateOnly(query.to) : today;
    const from = query.from
      ? parseDateOnly(query.from)
      : addDays(to, -(DEFAULT_HISTORY_DAYS - 1));

    if (from > to)
      throw new BadRequestException('"from" must not be after "to"');
    const spanDays =
      Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (spanDays > MAX_HISTORY_DAYS) {
      throw new BadRequestException(
        `Requested range spans ${spanDays} days; the maximum is ${MAX_HISTORY_DAYS}`,
      );
    }

    const [days, holidays, policy] = await Promise.all([
      this.prisma.attendanceDay.findMany({
        where: { employeeId, date: { gte: from, lte: to } },
      }),
      this.prisma.holiday.findMany({
        where: { isActive: true, date: { gte: from, lte: to } },
      }),
      this.getPolicyOrThrow(),
    ]);

    const daysByDate = new Map(
      days.map((day) => [formatDateOnly(day.date), day]),
    );
    const holidayDates = new Set(
      holidays.map((holiday) => formatDateOnly(holiday.date)),
    );
    const workingWeekdays = new Set(policy.workingWeekdays as number[]);

    const result: {
      date: string;
      status: AttendanceDayStatus;
      firstCheckInAt: Date | null;
      lastCheckOutAt: Date | null;
      workedMinutes: number | null;
      lateMinutes: number;
    }[] = [];

    for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
      const key = formatDateOnly(cursor);
      const day = daysByDate.get(key);
      if (day) {
        result.push({
          date: key,
          status: day.status,
          firstCheckInAt: day.firstCheckInAt,
          lastCheckOutAt: day.lastCheckOutAt,
          workedMinutes: day.workedMinutes,
          lateMinutes: day.lateMinutes,
        });
        continue;
      }

      // No AttendanceDay row exists — nothing happened that day, so nothing
      // ever created one (rows are only materialized reactively, on the
      // first event). Synthesize the classification instead of leaving a
      // gap: this is the reason Holiday and AttendancePolicy.workingWeekdays
      // exist in the schema.
      const isoWeekday = cursor.getUTCDay() === 0 ? 7 : cursor.getUTCDay();
      let status: AttendanceDayStatus;
      if (holidayDates.has(key)) status = 'HOLIDAY';
      else if (!workingWeekdays.has(isoWeekday)) status = 'WEEKEND';
      else if (cursor.getTime() >= today.getTime())
        continue; // today/future with no record yet: not "absent"
      else status = 'ABSENT';

      result.push({
        date: key,
        status,
        firstCheckInAt: null,
        lastCheckOutAt: null,
        workedMinutes: null,
        lateMinutes: 0,
      });
    }

    return result;
  }

  async recordCorrection(
    employeeId: string,
    dto: RecordCorrectionDto,
    actor: AuthContext,
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const occurredAt = new Date(dto.occurredAt);
    const date = toDateOnly(occurredAt);

    let day = await this.prisma.attendanceDay.findUnique({
      where: { employeeId_date: { employeeId, date } },
    });
    if (!day) {
      day = await this.prisma.attendanceDay.create({
        data: { employeeId, date },
      });
    }

    await this.prisma.attendanceEvent.create({
      data: {
        attendanceDayId: day.id,
        employeeId,
        type: dto.type,
        occurredAt,
        source: 'MANUAL_CORRECTION',
        recordedByUserId: actor.userId,
        note: dto.note,
      },
    });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'AttendanceDay',
      targetId: day.id,
      description: `Manual attendance correction: ${dto.type} at ${occurredAt.toISOString()}${dto.note ? ` (${dto.note})` : ''}`,
    });

    return this.recomputeDay(day.id);
  }

  async getPolicyOrThrow() {
    const policy = await this.prisma.attendancePolicy.findUnique({
      where: { id: 'singleton' },
    });
    if (!policy) {
      throw new InternalServerErrorException(
        'AttendancePolicy is not seeded — run the seed script before using attendance features',
      );
    }
    return policy;
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

  /**
   * Which event "wins" per type is resolved by recency of *creation*
   * (insertion order, approximated by cuid ordering — AttendanceEvent has
   * no separate createdAt), not by `occurredAt`. This is deliberate: a
   * correction must supersede the punch it's fixing regardless of whether
   * the corrected time is earlier or later than the original. Ordering by
   * `occurredAt` instead would only let corrections move check-in earlier
   * or check-out later — the opposite direction would be silently inert.
   */
  private async recomputeDay(attendanceDayId: string) {
    const day = await this.prisma.attendanceDay.findUniqueOrThrow({
      where: { id: attendanceDayId },
    });
    const events = await this.prisma.attendanceEvent.findMany({
      where: { attendanceDayId },
      orderBy: { id: 'asc' },
    });
    const policy = await this.getPolicyOrThrow();

    const lastOfType = (
      type: AttendanceEventType,
    ): AttendanceEventRow | undefined =>
      [...events].reverse().find((event) => event.type === type);

    const firstCheckInAt =
      lastOfType(AttendanceEventType.CHECK_IN)?.occurredAt ?? null;
    const lastCheckOutAt =
      lastOfType(AttendanceEventType.CHECK_OUT)?.occurredAt ?? null;
    const breakMinutes = this.computeBreakMinutes(events);

    let workedMinutes: number | null = null;
    if (firstCheckInAt && lastCheckOutAt) {
      const rawMinutes = Math.round(
        (lastCheckOutAt.getTime() - firstCheckInAt.getTime()) / 60_000,
      );
      workedMinutes = Math.max(0, rawMinutes - breakMinutes);
    }

    const lateMinutes = firstCheckInAt
      ? this.computeLateMinutes(firstCheckInAt, policy)
      : 0;

    let status: AttendanceDayStatus = day.status;
    if (day.leaveRequestId) {
      status = 'ON_LEAVE';
    } else if (firstCheckInAt && lastCheckOutAt) {
      const hours = (workedMinutes ?? 0) / 60;
      if (hours < policy.halfDayThresholdHours.toNumber()) status = 'HALF_DAY';
      else status = lateMinutes > 0 ? 'LATE' : 'PRESENT';
    } else if (firstCheckInAt) {
      // Still checked in — provisional classification until checkout.
      status = lateMinutes > 0 ? 'LATE' : 'PRESENT';
    }

    return this.prisma.attendanceDay.update({
      where: { id: attendanceDayId },
      data: {
        firstCheckInAt,
        lastCheckOutAt,
        workedMinutes,
        lateMinutes,
        status,
      },
    });
  }

  private computeBreakMinutes(events: AttendanceEventRow[]): number {
    let total = 0;
    let breakStart: Date | null = null;
    for (const event of events) {
      if (event.type === AttendanceEventType.BREAK_START) {
        breakStart = event.occurredAt;
      } else if (event.type === AttendanceEventType.BREAK_END && breakStart) {
        total += Math.max(
          0,
          Math.round(
            (event.occurredAt.getTime() - breakStart.getTime()) / 60_000,
          ),
        );
        breakStart = null;
      }
    }
    return total;
  }

  /**
   * `getHours()` (local) vs `getUTCHours()` (UTC) here is deliberate, not a
   * typo: `checkInAt` is a real timestamp, so its wall-clock reading needs
   * local getters (assuming host tz = company tz, see the module-level
   * comment). `standardStartTime` is a MySQL `TIME` column, which Prisma
   * always represents anchored at the Unix epoch in UTC regardless of host
   * timezone — so it needs UTC getters no matter where this runs.
   */
  private computeLateMinutes(
    checkInAt: Date,
    policy: { standardStartTime: Date; graceMinutes: number },
  ): number {
    const checkInMinutesOfDay =
      checkInAt.getHours() * 60 + checkInAt.getMinutes();
    const standard = policy.standardStartTime;
    const standardMinutesOfDay =
      standard.getUTCHours() * 60 + standard.getUTCMinutes();
    return Math.max(
      0,
      checkInMinutesOfDay - standardMinutesOfDay - policy.graceMinutes,
    );
  }

  private serializeToday(day: {
    id: string;
    firstCheckInAt: Date | null;
    lastCheckOutAt: Date | null;
    workedMinutes: number | null;
    lateMinutes: number;
    status: AttendanceDayStatus;
    date: Date;
  }) {
    const punchState = !day.firstCheckInAt
      ? 'NOT_CHECKED_IN'
      : !day.lastCheckOutAt
        ? 'CHECKED_IN'
        : 'CHECKED_OUT';
    return {
      date: formatDateOnly(day.date),
      punchState,
      status: day.status,
      firstCheckInAt: day.firstCheckInAt,
      lastCheckOutAt: day.lastCheckOutAt,
      workedMinutes: day.workedMinutes,
      lateMinutes: day.lateMinutes,
    };
  }
}
