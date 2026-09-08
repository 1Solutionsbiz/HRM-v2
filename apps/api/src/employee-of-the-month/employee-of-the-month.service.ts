import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext } from '../common/auth-context.js';
import type { NominateEmployeeOfTheMonthDto } from './dto/nominate-employee-of-the-month.dto.js';

const AWARD_INCLUDE = {
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      employeeCode: true,
      designation: { select: { title: true } },
      department: { select: { name: true } },
    },
  },
} as const;

@Injectable()
export class EmployeeOfTheMonthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /** Null when nobody's been picked for the current calendar month yet. */
  async getCurrent() {
    const now = new Date();
    const periodMonth = now.getUTCMonth() + 1;
    const periodYear = now.getUTCFullYear();

    const award = await this.prisma.employeeOfTheMonth.findUnique({
      where: { periodMonth_periodYear: { periodMonth, periodYear } },
      include: AWARD_INCLUDE,
    });
    return award;
  }

  async nominate(dto: NominateEmployeeOfTheMonthDto, actor: AuthContext) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
      select: { id: true, status: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    if (employee.status !== 'ACTIVE') {
      throw new BadRequestException('Only an active employee can be nominated');
    }

    const now = new Date();
    const periodMonth = dto.periodMonth ?? now.getUTCMonth() + 1;
    const periodYear = dto.periodYear ?? now.getUTCFullYear();

    const award = await this.prisma.employeeOfTheMonth.upsert({
      where: { periodMonth_periodYear: { periodMonth, periodYear } },
      create: {
        employeeId: dto.employeeId,
        periodMonth,
        periodYear,
        note: dto.note ?? null,
        nominatedByUserId: actor.userId,
      },
      update: {
        employeeId: dto.employeeId,
        note: dto.note ?? null,
        nominatedByUserId: actor.userId,
        nominatedAt: new Date(),
      },
      include: AWARD_INCLUDE,
    });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'EmployeeOfTheMonth',
      targetId: award.id,
      description: `Nominated ${award.employee.firstName} ${award.employee.lastName} as employee of the month for ${periodMonth}/${periodYear}`,
    });

    return award;
  }
}
