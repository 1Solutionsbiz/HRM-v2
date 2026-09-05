import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { parseDateOnly } from '../common/date-only.js';
import type { AuthContext } from '../common/auth-context.js';
import type { SubmitResignationDto } from './dto/submit-resignation.dto.js';
import type { DecideResignationDto } from './dto/decide-resignation.dto.js';

@Injectable()
export class ResignationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getMine(userId: string) {
    const employeeId = await this.requireEmployeeId(userId);
    return this.prisma.resignation.findMany({
      where: { employeeId },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async submit(userId: string, dto: SubmitResignationDto, actor: AuthContext) {
    const employeeId = await this.requireEmployeeId(userId);

    const existing = await this.prisma.resignation.findFirst({
      where: { employeeId, status: 'PENDING' },
    });
    if (existing)
      throw new ConflictException(
        'A resignation is already pending for this employee',
      );

    const submittedAt = new Date();
    const lastWorkingDay = parseDateOnly(dto.lastWorkingDay);
    if (
      lastWorkingDay < parseDateOnly(submittedAt.toISOString().slice(0, 10))
    ) {
      throw new BadRequestException('lastWorkingDay must not be in the past');
    }
    // Derived, not client-supplied — matches the mock's own data (lastWorkingDay
    // is always exactly noticePeriodDays after submittedOn there), and avoids
    // trusting an independently-suppliable number that could disagree with the dates.
    const noticePeriodDays = Math.round(
      (lastWorkingDay.getTime() -
        parseDateOnly(submittedAt.toISOString().slice(0, 10)).getTime()) /
        (24 * 60 * 60 * 1000),
    );

    const resignation = await this.prisma.resignation.create({
      data: {
        employeeId,
        reason: dto.reason,
        submittedAt,
        lastWorkingDay,
        noticePeriodDays,
      },
    });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Employee',
      targetId: employeeId,
      description: `Submitted resignation, last working day ${dto.lastWorkingDay}`,
    });

    return resignation;
  }

  async cancelMine(userId: string, resignationId: string, actor: AuthContext) {
    const employeeId = await this.requireEmployeeId(userId);
    const resignation = await this.prisma.resignation.findUnique({
      where: { id: resignationId },
    });
    if (!resignation || resignation.employeeId !== employeeId) {
      throw new NotFoundException('Resignation not found');
    }
    if (resignation.status !== 'PENDING') {
      throw new ConflictException(
        'Only a pending resignation can be withdrawn',
      );
    }

    const updated = await this.prisma.resignation.update({
      where: { id: resignationId },
      data: { status: 'WITHDRAWN' },
    });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Employee',
      targetId: employeeId,
      description: 'Resignation withdrawn by employee',
    });

    return updated;
  }

  getCompanyResignations() {
    return this.prisma.resignation.findMany({
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            designation: { select: { title: true } },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async decide(
    resignationId: string,
    dto: DecideResignationDto,
    actor: AuthContext,
  ) {
    const resignation = await this.prisma.resignation.findUnique({
      where: { id: resignationId },
    });
    if (!resignation) throw new NotFoundException('Resignation not found');
    if (resignation.status !== 'PENDING') {
      throw new ConflictException('This resignation has already been decided');
    }

    const updated = await this.prisma.resignation.update({
      where: { id: resignationId },
      data: {
        status: dto.decision,
        decidedByUserId: actor.userId,
        decidedAt: new Date(),
        decisionNote: dto.decisionNote,
      },
    });

    // Deliberately does not deactivate the Employee record — that's a
    // separate HR action (Users/Employees' status toggle), not an automatic
    // side effect. No scheduled-job infrastructure exists to defer it to
    // the actual lastWorkingDay, and doing it immediately on approval would
    // be premature (the employee's last day may be weeks away).
    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Employee',
      targetId: resignation.employeeId,
      description: `Resignation ${dto.decision === 'APPROVED' ? 'approved' : 'declined'}`,
    });

    return updated;
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
