import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext } from '../common/auth-context.js';
import type { UpdateHandbookSectionDto } from './dto/update-handbook-section.dto.js';

@Injectable()
export class HandbookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  getAll() {
    return this.prisma.handbookSection.findMany({ orderBy: { order: 'asc' } });
  }

  async update(id: string, dto: UpdateHandbookSectionDto, actor: AuthContext) {
    const existing = await this.prisma.handbookSection.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Handbook section not found');

    const section = await this.prisma.handbookSection.update({
      where: { id },
      data: { title: dto.title, body: dto.body, updatedByUserId: actor.userId },
    });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'HandbookSection',
      targetId: section.id,
      description: `Edited handbook section: ${section.title}`,
    });

    return section;
  }
}
