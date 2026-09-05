import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext } from '../common/auth-context.js';
import { parseDateOnly } from '../common/date-only.js';
import type { CreateHolidayDto } from './dto/create-holiday.dto.js';
import type { UpdateHolidayDto } from './dto/update-holiday.dto.js';

@Injectable()
export class HolidaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  getAll() {
    return this.prisma.holiday.findMany({
      where: { isActive: true },
      orderBy: { date: 'asc' },
    });
  }

  async create(dto: CreateHolidayDto, actor: AuthContext) {
    const date = parseDateOnly(dto.date);
    const existing = await this.prisma.holiday.findUnique({ where: { date } });
    if (existing) {
      throw new ConflictException('A holiday is already recorded for this date');
    }

    const holiday = await this.prisma.holiday.create({
      data: { name: dto.name, date },
    });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Holiday',
      targetId: holiday.id,
      description: `Added holiday "${holiday.name}" on ${dto.date}`,
    });

    return holiday;
  }

  async update(id: string, dto: UpdateHolidayDto, actor: AuthContext) {
    const holiday = await this.prisma.holiday.findUnique({ where: { id } });
    if (!holiday) throw new NotFoundException('Holiday not found');

    const date = dto.date ? parseDateOnly(dto.date) : undefined;
    if (date && date.getTime() !== holiday.date.getTime()) {
      const clashing = await this.prisma.holiday.findUnique({ where: { date } });
      if (clashing) {
        throw new ConflictException('A holiday is already recorded for this date');
      }
    }

    const updated = await this.prisma.holiday.update({
      where: { id },
      data: { name: dto.name, date },
    });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Holiday',
      targetId: id,
      description: `Updated holiday "${updated.name}"`,
    });

    return updated;
  }

  async remove(id: string, actor: AuthContext): Promise<void> {
    const holiday = await this.prisma.holiday.findUnique({ where: { id } });
    if (!holiday) throw new NotFoundException('Holiday not found');

    // Hard delete: Holiday has no incoming relations (AttendanceService's
    // history synthesis only ever reads it, never joins by id), and
    // `@@unique([date])` means a soft-delete would permanently block ever
    // recording a real holiday on that same calendar date again.
    await this.prisma.holiday.delete({ where: { id } });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Holiday',
      targetId: id,
      description: `Removed holiday "${holiday.name}"`,
    });
  }
}
