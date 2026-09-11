import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext } from '../common/auth-context.js';
import type { CreateProjectDto } from './dto/create-project.dto.js';
import type { UpdateProjectDto } from './dto/update-project.dto.js';

/**
 * A simple admin-managed lookup list so Daily Work Report task entries tag
 * a real company project from a dropdown instead of free text. Not part of
 * the original P1 scope, but the same feature area (see DailyReportsModule).
 */
@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  getAll() {
    return this.prisma.project.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });
  }

  async create(dto: CreateProjectDto, actor: AuthContext) {
    const existing = await this.prisma.project.findUnique({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException('A project with this name already exists');
    }

    const project = await this.prisma.project.create({ data: { name: dto.name } });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Project',
      targetId: project.id,
      description: `Added project "${project.name}"`,
    });

    return project;
  }

  async update(id: string, dto: UpdateProjectDto, actor: AuthContext) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');

    if (dto.name && dto.name !== project.name) {
      const clashing = await this.prisma.project.findUnique({ where: { name: dto.name } });
      if (clashing) throw new ConflictException('A project with this name already exists');
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: { name: dto.name, isActive: dto.isActive },
    });

    const changes: string[] = [];
    if (dto.name && dto.name !== project.name) changes.push(`renamed to "${updated.name}"`);
    if (dto.isActive !== undefined && dto.isActive !== project.isActive) {
      changes.push(updated.isActive ? 'unarchived' : 'archived');
    }

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Project',
      targetId: id,
      description: `Project "${project.name}" ${changes.join(', ') || 'updated'}`,
    });

    return updated;
  }

  async remove(id: string, actor: AuthContext): Promise<void> {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');

    // Check-first, not catch-after: this codebase's established convention
    // (see HolidaysService.create's date-clash check) rather than catching
    // a Prisma FK-constraint error after the fact.
    const usageCount = await this.prisma.dailyReportTaskEntry.count({ where: { projectId: id } });
    if (usageCount > 0) {
      throw new ConflictException(
        "This project is referenced by existing daily work reports and can't be removed. Rename it instead if it needs to change.",
      );
    }

    await this.prisma.project.delete({ where: { id } });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Project',
      targetId: id,
      description: `Removed project "${project.name}"`,
    });
  }
}
