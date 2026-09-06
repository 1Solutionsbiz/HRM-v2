import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { SequenceService } from '../sequence/sequence.service.js';
import { addDays, parseDateOnly } from '../common/date-only.js';
import type { AuthContext } from '../common/auth-context.js';
import { LeaveDayType } from '../generated/prisma/enums.js';
import type { Decimal } from '../generated/prisma/internal/prismaNamespace.js';
import type { ApplyLeaveDto } from './dto/apply-leave.dto.js';
import type { DecideLeaveRequestDto } from './dto/decide-leave-request.dto.js';

const ACTIVE_REQUEST_STATUSES = ['PENDING', 'APPROVED'] as const;

function daysBetweenInclusive(start: Date, end: Date): number {
  return (
    Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
  );
}

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly sequenceService: SequenceService,
  ) {}

  getLeaveTypes() {
    return this.prisma.leaveType.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async getBalancesForUser(userId: string) {
    const employeeId = await this.requireEmployeeId(userId);
    return this.getBalancesForEmployee(employeeId);
  }

  async getBalancesForEmployee(employeeId: string) {
    const year = new Date().getFullYear();

    const [leaveTypes, balances] = await Promise.all([
      this.prisma.leaveType.findMany({ where: { isActive: true } }),
      this.prisma.leaveBalance.findMany({ where: { employeeId, year } }),
    ]);
    return this.toBalanceRows(leaveTypes, balances, year);
  }

  /**
   * One roster row per active employee (no argument to scope to a single
   * one) so admins/managers/HR can see everyone's balance at a glance
   * instead of opening each employee's profile - reuses the exact same
   * per-type math as getBalancesForEmployee via toBalanceRows.
   */
  async getCompanyBalances() {
    const year = new Date().getFullYear();

    const [employees, leaveTypes, balances] = await Promise.all([
      this.prisma.employee.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          department: { select: { name: true } },
          designation: { select: { title: true } },
        },
        orderBy: { firstName: 'asc' },
      }),
      this.prisma.leaveType.findMany({ where: { isActive: true } }),
      this.prisma.leaveBalance.findMany({
        where: { year, employee: { status: 'ACTIVE' } },
      }),
    ]);

    const balancesByEmployee = new Map<string, typeof balances>();
    for (const balance of balances) {
      const list = balancesByEmployee.get(balance.employeeId) ?? [];
      list.push(balance);
      balancesByEmployee.set(balance.employeeId, list);
    }

    return employees.map((employee) => ({
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
      avatarUrl: employee.avatarUrl,
      department: employee.department,
      designation: employee.designation,
      balances: this.toBalanceRows(
        leaveTypes,
        balancesByEmployee.get(employee.id) ?? [],
        year,
      ),
    }));
  }

  // A LeaveBalance row is only created for real on first approval (see
  // decide()) — until then this synthesizes the view from
  // LeaveType.defaultAnnualDays, which exists in the schema for exactly
  // this. Never persisted here: allocating a real balance is an HR action,
  // not a side effect of a GET.
  private toBalanceRows(
    leaveTypes: { id: string; key: string; name: string; defaultAnnualDays: Decimal }[],
    balances: {
      leaveTypeId: string;
      allocatedDays: Decimal;
      carriedOverDays: Decimal;
      usedDays: Decimal;
    }[],
    year: number,
  ) {
    const balanceByType = new Map(
      balances.map((balance) => [balance.leaveTypeId, balance]),
    );
    return leaveTypes.map((leaveType) => {
      const balance = balanceByType.get(leaveType.id);
      const allocatedDays = balance
        ? balance.allocatedDays.toNumber()
        : leaveType.defaultAnnualDays.toNumber();
      const carriedOverDays = balance ? balance.carriedOverDays.toNumber() : 0;
      const usedDays = balance ? balance.usedDays.toNumber() : 0;
      return {
        leaveTypeId: leaveType.id,
        leaveTypeKey: leaveType.key,
        leaveTypeName: leaveType.name,
        year,
        allocatedDays,
        carriedOverDays,
        usedDays,
        remainingDays: allocatedDays + carriedOverDays - usedDays,
      };
    });
  }

  async getMyRequests(userId: string) {
    const employeeId = await this.requireEmployeeId(userId);
    const requests = await this.prisma.leaveRequest.findMany({
      where: { employeeId },
      include: { leaveType: { select: { key: true, name: true } } },
      orderBy: { submittedAt: 'desc' },
    });
    return requests.map((request) => this.serializeRequest(request));
  }

  async applyLeave(userId: string, dto: ApplyLeaveDto, actor: AuthContext) {
    const employeeId = await this.requireEmployeeId(userId);

    const leaveType = await this.prisma.leaveType.findUnique({
      where: { id: dto.leaveTypeId },
    });
    if (!leaveType || !leaveType.isActive) {
      throw new BadRequestException(
        'leaveTypeId does not reference an active leave type',
      );
    }

    const startDate = parseDateOnly(dto.startDate);
    const endDate = parseDateOnly(dto.endDate);
    if (startDate > endDate)
      throw new BadRequestException('startDate must not be after endDate');

    const dayType = dto.dayType ?? LeaveDayType.FULL_DAY;
    if (
      dayType === LeaveDayType.HALF_DAY &&
      startDate.getTime() !== endDate.getTime()
    ) {
      throw new BadRequestException(
        'A half-day leave request must have the same startDate and endDate',
      );
    }
    const totalDays =
      dayType === LeaveDayType.HALF_DAY
        ? 0.5
        : daysBetweenInclusive(startDate, endDate);

    await this.assertNoOverlap(employeeId, startDate, endDate);
    await this.assertWithinBalance(
      employeeId,
      leaveType,
      startDate.getFullYear(),
      totalDays,
    );

    const sequence = await this.sequenceService.next('leaveRequestCode');
    const code = `LV-${String(sequence).padStart(4, '0')}`;

    const request = await this.prisma.leaveRequest.create({
      data: {
        code,
        employeeId,
        leaveTypeId: dto.leaveTypeId,
        startDate,
        endDate,
        dayType,
        halfDayPeriod: dto.halfDayPeriod,
        totalDays,
        reason: dto.reason,
      },
    });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'LeaveRequest',
      targetId: request.id,
      description: `Applied for ${leaveType.name}: ${dto.startDate} to ${dto.endDate} (${totalDays} day(s))`,
    });

    return this.serializeRequest(request);
  }

  async cancelMyRequest(userId: string, requestId: string, actor: AuthContext) {
    const employeeId = await this.requireEmployeeId(userId);
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id: requestId },
    });
    if (!request || request.employeeId !== employeeId) {
      throw new NotFoundException('Leave request not found');
    }
    if (request.status !== 'PENDING') {
      throw new ConflictException(
        'Only a pending leave request can be cancelled',
      );
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELLED' },
    });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'LeaveRequest',
      targetId: requestId,
      description: 'Leave request cancelled by employee',
    });

    return this.serializeRequest(updated);
  }

  async getCompanyRequests() {
    const requests = await this.prisma.leaveRequest.findMany({
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        leaveType: { select: { key: true, name: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
    return requests.map((request) => this.serializeRequest(request));
  }

  async decide(
    requestId: string,
    dto: DecideLeaveRequestDto,
    actor: AuthContext,
  ) {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Leave request not found');
    if (request.status !== 'PENDING') {
      throw new ConflictException(
        'This leave request has already been decided or cancelled',
      );
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: dto.decision,
        approverUserId: actor.userId,
        decidedAt: new Date(),
        decisionNote: dto.decisionNote,
      },
    });

    if (dto.decision === 'APPROVED') {
      await this.recordApprovedUsage(
        request.employeeId,
        request.leaveTypeId,
        request.startDate,
        request.totalDays,
      );
      await this.markAttendanceDaysOnLeave(
        request.employeeId,
        request.startDate,
        request.endDate,
        request.id,
      );
    }

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'LeaveRequest',
      targetId: requestId,
      description: `Leave request ${request.code} ${dto.decision.toLowerCase()}`,
    });

    return this.serializeRequest(updated);
  }

  /**
   * `LeaveRequest.totalDays` is a Prisma `Decimal` — decimal.js's own
   * `toJSON()` returns a string, so an un-converted Decimal would silently
   * serialize as `"1"` over HTTP instead of the number `1`, unlike
   * `getBalancesForUser()`'s fields (already plain numbers). Converting
   * here keeps every endpoint's `totalDays` the same JSON type.
   */
  private serializeRequest<T extends { totalDays: { toNumber(): number } }>(
    request: T,
  ) {
    return { ...request, totalDays: request.totalDays.toNumber() };
  }

  private async recordApprovedUsage(
    employeeId: string,
    leaveTypeId: string,
    startDate: Date,
    totalDays: Decimal,
  ) {
    const year = startDate.getFullYear();
    const leaveType = await this.prisma.leaveType.findUniqueOrThrow({
      where: { id: leaveTypeId },
    });

    await this.prisma.leaveBalance.upsert({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
      create: {
        employeeId,
        leaveTypeId,
        year,
        allocatedDays: leaveType.defaultAnnualDays,
        usedDays: totalDays,
      },
      update: { usedDays: { increment: totalDays } },
    });
  }

  /**
   * Marks every day of an approved leave (full or half) as ON_LEAVE,
   * regardless of any punches recorded that day — a first-pass
   * simplification. `AttendanceService.recomputeDay()` treats
   * `AttendanceDay.leaveRequestId` as authoritative and always forces
   * ON_LEAVE when set, so this write is the one place outside Attendance's
   * own event-sourced path that touches an AttendanceDay directly; it's
   * legitimate here because a leave approval isn't derived from punches at
   * all. A half-day leave alongside a half-day of actual attendance is not
   * modeled — the whole day is classified ON_LEAVE.
   */
  private async markAttendanceDaysOnLeave(
    employeeId: string,
    startDate: Date,
    endDate: Date,
    leaveRequestId: string,
  ): Promise<void> {
    for (
      let cursor = startDate;
      cursor <= endDate;
      cursor = addDays(cursor, 1)
    ) {
      const existing = await this.prisma.attendanceDay.findUnique({
        where: { employeeId_date: { employeeId, date: cursor } },
      });
      if (existing) {
        await this.prisma.attendanceDay.update({
          where: { id: existing.id },
          data: { status: 'ON_LEAVE', leaveRequestId },
        });
      } else {
        await this.prisma.attendanceDay.create({
          data: {
            employeeId,
            date: cursor,
            status: 'ON_LEAVE',
            leaveRequestId,
          },
        });
      }
    }
  }

  /**
   * New validation, not a legacy rule to inspect (rule 13 doesn't apply —
   * legacy computed remaining balance ad hoc with no overlap check at all).
   * Only PENDING/APPROVED requests block a new one; a REJECTED or
   * CANCELLED request never should.
   */
  private async assertNoOverlap(
    employeeId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    const overlapping = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: { in: [...ACTIVE_REQUEST_STATUSES] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });
    if (overlapping) {
      throw new ConflictException(
        `This overlaps an existing ${overlapping.status.toLowerCase()} leave request`,
      );
    }
  }

  /**
   * Available = (persisted allocation, or LeaveType.defaultAnnualDays if no
   * balance row exists yet) minus every PENDING/APPROVED request's days —
   * computed live from LeaveRequest rows, not from LeaveBalance.usedDays
   * (which only updates on approval, see recordApprovedUsage). This is
   * deliberate: it prevents double-booking across multiple pending
   * requests without needing to reserve/release a counter at submission
   * time.
   */
  private async assertWithinBalance(
    employeeId: string,
    leaveType: { id: string; defaultAnnualDays: { toNumber(): number } },
    year: number,
    requestedDays: number,
  ): Promise<void> {
    const [balance, activeRequests] = await Promise.all([
      this.prisma.leaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId,
            leaveTypeId: leaveType.id,
            year,
          },
        },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          employeeId,
          leaveTypeId: leaveType.id,
          status: { in: [...ACTIVE_REQUEST_STATUSES] },
        },
      }),
    ]);

    const allocation = balance
      ? balance.allocatedDays.toNumber() + balance.carriedOverDays.toNumber()
      : leaveType.defaultAnnualDays.toNumber();
    const committedDays = activeRequests.reduce(
      (sum, request) => sum + request.totalDays.toNumber(),
      0,
    );

    if (committedDays + requestedDays > allocation) {
      const remaining = allocation - committedDays;
      throw new BadRequestException(
        `This request exceeds the available balance (${Math.max(0, remaining)} day(s) remaining)`,
      );
    }
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
