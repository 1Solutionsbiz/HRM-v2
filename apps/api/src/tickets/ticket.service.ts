import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { SequenceService } from '../sequence/sequence.service.js';
import type { AuthContext } from '../common/auth-context.js';
import { TicketStatus } from '../generated/prisma/enums.js';
import type { CreateTicketDto } from './dto/create-ticket.dto.js';
import type { UpdateTicketStatusDto } from './dto/update-ticket-status.dto.js';
import type { AddTicketCommentDto } from './dto/add-ticket-comment.dto.js';

const TICKET_INCLUDE = {
  employee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  comments: {
    orderBy: { createdAt: 'asc' as const },
    include: { authorUser: { select: { id: true, email: true } } },
  },
} as const;

@Injectable()
export class TicketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly sequenceService: SequenceService,
  ) {}

  async getMyTickets(userId: string) {
    const employeeId = await this.requireEmployeeId(userId);
    return this.prisma.ticket.findMany({
      where: { employeeId },
      include: TICKET_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateTicketDto, actor: AuthContext) {
    const employeeId = await this.requireEmployeeId(userId);
    const sequence = await this.sequenceService.next('ticketCode');
    const code = `TKT-${String(sequence).padStart(4, '0')}`;

    const ticket = await this.prisma.ticket.create({
      data: {
        code,
        employeeId,
        category: dto.category,
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
      },
      include: TICKET_INCLUDE,
    });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Ticket',
      targetId: ticket.id,
      description: `Raised ticket ${code}: ${dto.title}`,
    });

    return ticket;
  }

  // HR/admin roster — every ticket, regardless of raiser. Gated by
  // ticket:manage at the controller.
  getCompanyTickets() {
    return this.prisma.ticket.findMany({
      include: TICKET_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(ticketId: string, dto: UpdateTicketStatusDto, actor: AuthContext) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: dto.status,
        resolvedAt: dto.status === TicketStatus.RESOLVED ? new Date() : ticket.resolvedAt,
        closedAt: dto.status === TicketStatus.CLOSED ? new Date() : ticket.closedAt,
      },
      include: TICKET_INCLUDE,
    });

    await this.auditService.log({
      eventType: 'OTHER',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Ticket',
      targetId: ticketId,
      description: `Ticket ${ticket.code} status changed to ${dto.status}`,
    });

    return updated;
  }

  // Reachable by the raising employee or anyone holding ticket:manage —
  // no route-level @RequirePermissions fits both, so the ownership check
  // happens here (mirrors the legacy "Add a Comment" thread on both the
  // employee and HR views of the same ticket).
  async addComment(ticketId: string, dto: AddTicketCommentDto, actor: AuthContext) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { employee: { select: { userId: true } } },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const isOwner = ticket.employee.userId === actor.userId;
    const canManage = actor.permissions.includes('ticket:manage');
    if (!isOwner && !canManage) {
      throw new ForbiddenException('Not authorized to comment on this ticket');
    }

    await this.prisma.ticketComment.create({
      data: { ticketId, authorUserId: actor.userId, body: dto.body },
    });

    return this.prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      include: TICKET_INCLUDE,
    });
  }

  private async requireEmployeeId(userId: string): Promise<string> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException('No employee profile is linked to this account');
    }
    return employee.id;
  }
}
