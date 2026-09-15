import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { SequenceService } from '../sequence/sequence.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AttendanceService } from '../attendance/attendance.service.js';
import { addDays, parseDateOnly, toDateOnly } from '../common/date-only.js';
import type { AuthContext } from '../common/auth-context.js';
import { LeaveDayType } from '../generated/prisma/enums.js';
import type { Decimal } from '../generated/prisma/internal/prismaNamespace.js';
import type { ApplyLeaveDto } from './dto/apply-leave.dto.js';
import type { DecideLeaveRequestDto } from './dto/decide-leave-request.dto.js';
import type { RevokeLeaveRequestDto } from './dto/revoke-leave-request.dto.js';
import {
  BUDGET_WEIGHT,
  DEDUCTION_TOTAL_DAYS,
  MONTHLY_FREE_BUDGET,
  classifyByMonthlyBudget,
} from './leave-budget.util.js';

const ACTIVE_REQUEST_STATUSES = ['PENDING', 'APPROVED'] as const;

// Company policy (2026-09-15, not yet its own schema field): every leave
// request is single-day, chosen by duration (Full/Half/Short) rather than
// a picked type. Each calendar month gives 1 free full-day-equivalent,
// consumed at BUDGET_WEIGHT per duration; once that's exhausted the new
// request is auto-recorded as Loss of Pay instead of the free type
// (Casual Leave), charged at DEDUCTION_TOTAL_DAYS - see leave-budget.util.ts
// for why that's a deliberately different fraction than BUDGET_WEIGHT for
// Short Leave. Supersedes the older Casual-Leave-only monthly cap this
// generalizes from.
const CASUAL_LEAVE_KEY = 'casual-leave-1-day';
const LOSS_OF_PAY_KEY = 'loss-of-pay';

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly sequenceService: SequenceService,
    private readonly notificationsService: NotificationsService,
    private readonly attendanceService: AttendanceService,
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

  async getLedgerForUser(userId: string, year: number) {
    const employeeId = await this.requireEmployeeId(userId);
    return this.getLedgerForEmployee(employeeId, year);
  }

  async getBalancesForEmployee(employeeId: string) {
    const year = new Date().getFullYear();

    const [leaveTypes, balances, committedThisMonth] = await Promise.all([
      this.prisma.leaveType.findMany({ where: { isActive: true } }),
      this.prisma.leaveBalance.findMany({ where: { employeeId, year } }),
      this.getCurrentMonthCommittedBudget(employeeId),
    ]);
    return [
      this.buildMonthlyBudgetRow(committedThisMonth),
      ...this.toBalanceRows(leaveTypes, balances, year),
    ];
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

    const committedByEmployee = await this.getCurrentMonthCommittedBudgetByEmployee(
      employees.map((e) => e.id),
    );

    return employees.map((employee) => ({
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
      avatarUrl: employee.avatarUrl,
      department: employee.department,
      designation: employee.designation,
      balances: [
        this.buildMonthlyBudgetRow(committedByEmployee.get(employee.id) ?? 0),
        ...this.toBalanceRows(
          leaveTypes,
          balancesByEmployee.get(employee.id) ?? [],
          year,
        ),
      ],
    }));
  }

  /**
   * Per leave type, a running month-by-month view of real approved usage -
   * "leaves taken" is the sum of APPROVED LeaveRequest.totalDays whose
   * startDate falls in that month (the same rows that drive
   * LeaveBalance.usedDays via recordApprovedUsage, so the two stay
   * consistent), and "balance" is the running remaining total through that
   * month. Only synthesizes real data - no monthly accrual schedule exists
   * (see toBalanceRows' own comment), so months only go up to the current
   * month for the current year (there's nothing to show for a month that
   * hasn't happened) and all 12 for a past year.
   */
  async getLedgerForEmployee(employeeId: string, year: number) {
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

    const [leaveTypes, balances, requests, committedThisMonth] = await Promise.all([
      this.prisma.leaveType.findMany({ where: { isActive: true } }),
      this.prisma.leaveBalance.findMany({ where: { employeeId, year } }),
      this.prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: 'APPROVED',
          startDate: { gte: yearStart, lt: yearEnd },
        },
        orderBy: { startDate: 'asc' },
      }),
      this.getCurrentMonthCommittedBudget(employeeId),
    ]);

    const balanceRows = this.toBalanceRows(leaveTypes, balances, year);
    const requestsByType = new Map<string, typeof requests>();
    for (const request of requests) {
      const list = requestsByType.get(request.leaveTypeId) ?? [];
      list.push(request);
      requestsByType.set(request.leaveTypeId, list);
    }

    const now = new Date();
    const lastMonth = year === now.getUTCFullYear() ? now.getUTCMonth() + 1 : 12;

    const typeMonthRows = balanceRows.map((row) => {
      const typeRequests = requestsByType.get(row.leaveTypeId) ?? [];
      const totalDays = row.allocatedDays + row.carriedOverDays;
      let cumulativeUsed = 0;

      const months = Array.from({ length: lastMonth }, (_, i) => {
        const month = i + 1;
        const monthRequests = typeRequests.filter(
          (r) => r.startDate.getUTCMonth() + 1 === month,
        );
        // balanceAfter is computed per-request, in the same chronological
        // order the containing array is already sorted in (startDate asc,
        // carried over from the top-level query) - cumulativeUsed threading
        // through every month's loop this way keeps months[].balance
        // identical to the pre-existing month-granularity computation.
        const requestsWithBalance = monthRequests.map((r) => {
          cumulativeUsed += r.totalDays.toNumber();
          return {
            id: r.id,
            startDate: r.startDate,
            endDate: r.endDate,
            totalDays: r.totalDays.toNumber(),
            reason: r.reason,
            dayType: r.dayType,
            balanceAfter: totalDays - cumulativeUsed,
          };
        });
        return {
          month,
          leavesTaken: requestsWithBalance.reduce((sum, r) => sum + r.totalDays, 0),
          balance: totalDays - cumulativeUsed,
          requests: requestsWithBalance,
        };
      });

      return { ...row, months };
    });

    // The Monthly free-budget row resets every month by construction - each
    // month's requests are summed independently via BUDGET_WEIGHT (not
    // cumulatively across the year, unlike the per-type rows above).
    const monthlyBudgetMonths = Array.from({ length: lastMonth }, (_, i) => {
      const month = i + 1;
      const monthRequests = requests.filter(
        (r) => r.startDate.getUTCMonth() + 1 === month,
      );
      let cumulativeBudget = 0;
      const requestsWithBalance = monthRequests.map((r) => {
        cumulativeBudget += BUDGET_WEIGHT[r.dayType];
        return {
          id: r.id,
          startDate: r.startDate,
          endDate: r.endDate,
          totalDays: r.totalDays.toNumber(),
          reason: r.reason,
          dayType: r.dayType,
          balanceAfter: MONTHLY_FREE_BUDGET - cumulativeBudget,
        };
      });
      return {
        month,
        leavesTaken: requestsWithBalance.reduce((sum, r) => sum + r.totalDays, 0),
        balance: MONTHLY_FREE_BUDGET - cumulativeBudget,
        requests: requestsWithBalance,
      };
    });
    const monthlyBudgetRow = {
      ...this.buildMonthlyBudgetRow(committedThisMonth),
      months: monthlyBudgetMonths,
    };

    return [monthlyBudgetRow, ...typeMonthRows];
  }

  /**
   * A synthetic balance row for the monthly free-leave budget - not backed
   * by any LeaveType/LeaveBalance row. `committedThisMonth` is the sum of
   * BUDGET_WEIGHT over this employee's PENDING+APPROVED requests in the
   * current calendar month (see getCurrentMonthCommittedBudget).
   */
  private buildMonthlyBudgetRow(committedThisMonth: number) {
    return {
      leaveTypeId: 'monthly-budget',
      leaveTypeKey: 'monthly-budget',
      leaveTypeName: 'Monthly',
      year: new Date().getFullYear(),
      allocatedDays: MONTHLY_FREE_BUDGET,
      carriedOverDays: 0,
      usedDays: committedThisMonth,
      remainingDays: Math.max(0, MONTHLY_FREE_BUDGET - committedThisMonth),
    };
  }

  private async getCurrentMonthCommittedBudget(employeeId: string): Promise<number> {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    const requests = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: { in: [...ACTIVE_REQUEST_STATUSES] },
        startDate: { gte: monthStart, lte: monthEnd },
      },
      select: { dayType: true },
    });
    return requests.reduce((sum, r) => sum + BUDGET_WEIGHT[r.dayType], 0);
  }

  /** Batched version of getCurrentMonthCommittedBudget for a whole roster - one query instead of N. */
  private async getCurrentMonthCommittedBudgetByEmployee(
    employeeIds: string[],
  ): Promise<Map<string, number>> {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    const requests = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: { in: [...ACTIVE_REQUEST_STATUSES] },
        startDate: { gte: monthStart, lte: monthEnd },
      },
      select: { employeeId: true, dayType: true },
    });
    const byEmployee = new Map<string, number>();
    for (const r of requests) {
      byEmployee.set(r.employeeId, (byEmployee.get(r.employeeId) ?? 0) + BUDGET_WEIGHT[r.dayType]);
    }
    return byEmployee;
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

    const startDate = parseDateOnly(dto.startDate);
    const endDate = parseDateOnly(dto.endDate);
    if (startDate.getTime() !== endDate.getTime()) {
      throw new BadRequestException('Leave requests are single-day only');
    }
    const dayType = dto.dayType ?? LeaveDayType.FULL_DAY;

    await this.assertNoOverlap(employeeId, startDate, endDate);

    const monthStart = new Date(
      Date.UTC(startDate.getFullYear(), startDate.getMonth(), 1),
    );
    const monthEnd = new Date(
      Date.UTC(startDate.getFullYear(), startDate.getMonth() + 1, 0),
    );
    const existingThisMonth = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: { in: [...ACTIVE_REQUEST_STATUSES] },
        startDate: { gte: monthStart, lte: monthEnd },
      },
      select: { id: true, startDate: true, dayType: true },
    });
    const classification = classifyByMonthlyBudget([
      ...existingThisMonth.map((r) => ({
        key: r.id,
        startDate: r.startDate,
        dayType: r.dayType,
      })),
      { key: 'NEW', startDate, dayType },
    ]);
    const isFree = classification.get('NEW')!;

    const [casualLeaveType, lossOfPayType] = await Promise.all([
      this.prisma.leaveType.findUniqueOrThrow({ where: { key: CASUAL_LEAVE_KEY } }),
      this.prisma.leaveType.findUniqueOrThrow({ where: { key: LOSS_OF_PAY_KEY } }),
    ]);
    const effectiveLeaveType = isFree ? casualLeaveType : lossOfPayType;
    const totalDays = DEDUCTION_TOTAL_DAYS[dayType];

    const sequence = await this.sequenceService.next('leaveRequestCode');
    const code = `LV-${String(sequence).padStart(4, '0')}`;

    const request = await this.prisma.leaveRequest.create({
      data: {
        code,
        employeeId,
        leaveTypeId: effectiveLeaveType.id,
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
      description: isFree
        ? `Applied for ${dayType} leave on ${dto.startDate} — within the monthly free allowance, recorded as ${effectiveLeaveType.name}`
        : `Applied for ${dayType} leave on ${dto.startDate} — exceeds the monthly free allowance, recorded as ${effectiveLeaveType.name} (${totalDays} day(s) deducted)`,
    });

    return {
      ...this.serializeRequest(request),
      autoConvertedToLossOfPay: !isFree,
    };
  }

  /**
   * PENDING cancels freely, same as before. APPROVED can also be
   * self-cancelled now (plans changed after the fact), but only while the
   * leave hasn't started yet — once startDate has arrived, the employee
   * has (or hasn't) actually taken the day; "cancelling" it after the fact
   * would misrepresent what happened rather than correct a plan, so that
   * case is HR territory, not self-service.
   */
  async cancelMyRequest(userId: string, requestId: string, actor: AuthContext) {
    const employeeId = await this.requireEmployeeId(userId);
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id: requestId },
    });
    if (!request || request.employeeId !== employeeId) {
      throw new NotFoundException('Leave request not found');
    }
    if (request.status !== 'PENDING' && request.status !== 'APPROVED') {
      throw new ConflictException(
        'Only a pending or approved leave request can be cancelled',
      );
    }
    const wasApproved = request.status === 'APPROVED';
    if (wasApproved && request.startDate <= toDateOnly(new Date())) {
      throw new ConflictException(
        'This leave has already started or passed and can no longer be self-cancelled — contact HR for a correction',
      );
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELLED' },
    });

    if (wasApproved) {
      await this.reverseApprovedUsage(
        request.employeeId,
        request.leaveTypeId,
        request.startDate,
        request.totalDays,
      );
      await this.attendanceService.unmarkApprovedLeave(
        request.employeeId,
        request.startDate,
        request.endDate,
        request.id,
      );

      const employee = await this.prisma.employee.findUnique({
        where: { id: request.employeeId },
        select: { managerId: true, firstName: true, lastName: true },
      });
      if (employee?.managerId) {
        await this.notificationsService.createForEmployee(employee.managerId, {
          type: 'LEAVE',
          title: 'Approved leave cancelled',
          description: `${employee.firstName} ${employee.lastName} cancelled their approved leave request ${request.code}.`,
          linkUrl: '/team/leave-approvals',
        });
      }
    }

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'LeaveRequest',
      targetId: requestId,
      description: wasApproved
        ? `Approved leave request ${request.code} cancelled by employee`
        : 'Leave request cancelled by employee',
    });

    return this.serializeRequest(updated);
  }

  /**
   * The HR/admin-side counterpart to cancelMyRequest's self-cancel path -
   * works on any APPROVED request regardless of who owns it or whether
   * startDate has already arrived, which is exactly the case self-cancel
   * deliberately blocks ("contact HR for a correction"). Reuses the same
   * reversal machinery (reverseApprovedUsage/unmarkApprovedLeave) so a
   * revoked leave unwinds identically to a self-cancelled one - the
   * distinction is who's allowed to trigger it and when, not what happens
   * once triggered.
   */
  async revoke(requestId: string, dto: RevokeLeaveRequestDto, actor: AuthContext) {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Leave request not found');
    if (request.status !== 'APPROVED') {
      throw new ConflictException('Only an approved leave request can be revoked');
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELLED', decisionNote: dto.note ?? request.decisionNote },
    });

    await this.reverseApprovedUsage(
      request.employeeId,
      request.leaveTypeId,
      request.startDate,
      request.totalDays,
    );
    await this.attendanceService.unmarkApprovedLeave(
      request.employeeId,
      request.startDate,
      request.endDate,
      request.id,
    );

    await this.notificationsService.createForEmployee(request.employeeId, {
      type: 'LEAVE',
      title: 'Approved leave revoked',
      description: dto.note
        ? `Your approved leave request ${request.code} was revoked by HR: ${dto.note}`
        : `Your approved leave request ${request.code} was revoked by HR.`,
      linkUrl: '/leave',
    });

    const employee = await this.prisma.employee.findUnique({
      where: { id: request.employeeId },
      select: { managerId: true, firstName: true, lastName: true },
    });
    if (employee?.managerId) {
      await this.notificationsService.createForEmployee(employee.managerId, {
        type: 'LEAVE',
        title: 'Approved leave revoked',
        description: `${employee.firstName} ${employee.lastName}'s approved leave request ${request.code} was revoked by HR.`,
        linkUrl: '/team/leave-approvals',
      });
    }

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'LeaveRequest',
      targetId: requestId,
      description: dto.note
        ? `Approved leave request ${request.code} revoked by HR: ${dto.note}`
        : `Approved leave request ${request.code} revoked by HR`,
    });

    return this.serializeRequest(updated);
  }

  /** Active employees only - a resigned employee's past leave history isn't this approvals screen's concern, same convention as DailyReportsService.getTeamReports' roster query. */
  async getCompanyRequests() {
    const requests = await this.prisma.leaveRequest.findMany({
      where: { employee: { status: 'ACTIVE' } },
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

    await this.notificationsService.createForEmployee(request.employeeId, {
      type: 'LEAVE',
      title: `Leave request ${dto.decision === 'APPROVED' ? 'approved' : 'rejected'}`,
      description: `Your leave request ${request.code} was ${dto.decision.toLowerCase()}.`,
      linkUrl: '/leave',
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

  /** Reverses recordApprovedUsage when an approved leave is cancelled — the LeaveBalance row is guaranteed to already exist, since only an APPROVED request (which always ran recordApprovedUsage on the way in) reaches here. */
  private async reverseApprovedUsage(
    employeeId: string,
    leaveTypeId: string,
    startDate: Date,
    totalDays: Decimal,
  ) {
    const year = startDate.getFullYear();
    await this.prisma.leaveBalance.update({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
      data: { usedDays: { decrement: totalDays } },
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
