import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TicketService } from './ticket.service.js';
import type { AuthContext } from '../common/auth-context.js';

function buildPrismaMock() {
  return {
    employee: { findUnique: vi.fn() },
    ticket: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    ticketComment: { create: vi.fn() },
  };
}

const employeeActor: AuthContext = {
  userId: 'user-1',
  sessionId: 's1',
  email: 'employee@example.com',
  roles: ['employee'],
  permissions: [],
};

const hrActor: AuthContext = {
  userId: 'user-hr',
  sessionId: 's2',
  email: 'hr@example.com',
  roles: ['hr'],
  permissions: ['ticket:manage'],
};

describe('TicketService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let sequenceService: { next: ReturnType<typeof vi.fn> };
  let auditService: { log: ReturnType<typeof vi.fn> };
  let notificationsService: { createForEmployee: ReturnType<typeof vi.fn> };
  let service: TicketService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
    sequenceService = { next: vi.fn().mockResolvedValue(7) };
    auditService = { log: vi.fn().mockResolvedValue(undefined) };
    notificationsService = { createForEmployee: vi.fn().mockResolvedValue(undefined) };
    service = new TicketService(prisma as any, auditService as any, sequenceService as any, notificationsService as any);
  });

  describe('create', () => {
    it('generates a padded TKT- code and logs an audit entry', async () => {
      prisma.ticket.create.mockResolvedValue({ id: 'tkt-1', code: 'TKT-0007' });

      await service.create(
        employeeActor.userId,
        { category: 'MISPUNCH', title: 'Missed punch on 5th', description: 'Forgot to check out' } as any,
        employeeActor,
      );

      expect(sequenceService.next).toHaveBeenCalledWith('ticketCode');
      expect(prisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ code: 'TKT-0007', employeeId: 'emp-1' }) }),
      );
      expect(auditService.log).toHaveBeenCalled();
    });

    it('throws if the actor has no linked employee profile', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      await expect(
        service.create(employeeActor.userId, { category: 'MISPUNCH', title: 't', description: 'd' } as any, employeeActor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('stamps resolvedAt when moving to RESOLVED', async () => {
      prisma.ticket.findUnique.mockResolvedValue({ id: 'tkt-1', code: 'TKT-0007', resolvedAt: null, closedAt: null });
      prisma.ticket.update.mockResolvedValue({ id: 'tkt-1' });

      await service.updateStatus('tkt-1', { status: 'RESOLVED' } as any, hrActor);

      const updateArgs = prisma.ticket.update.mock.calls[0][0];
      expect(updateArgs.data.status).toBe('RESOLVED');
      expect(updateArgs.data.resolvedAt).toBeInstanceOf(Date);
      expect(updateArgs.data.closedAt).toBeNull();
    });

    it('throws if the ticket does not exist', async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);
      await expect(service.updateStatus('missing', { status: 'CLOSED' } as any, hrActor)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addComment', () => {
    it('allows the raising employee to comment on their own ticket', async () => {
      prisma.ticket.findUnique.mockResolvedValue({ id: 'tkt-1', employee: { userId: employeeActor.userId } });
      prisma.ticket.findUniqueOrThrow.mockResolvedValue({ id: 'tkt-1' });

      await service.addComment('tkt-1', { body: 'Any update?' } as any, employeeActor);

      expect(prisma.ticketComment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { ticketId: 'tkt-1', authorUserId: employeeActor.userId, body: 'Any update?' },
        }),
      );
    });

    it('allows an actor with ticket:manage to comment on someone else\'s ticket', async () => {
      prisma.ticket.findUnique.mockResolvedValue({ id: 'tkt-1', employee: { userId: 'someone-else' } });
      prisma.ticket.findUniqueOrThrow.mockResolvedValue({ id: 'tkt-1' });

      await expect(service.addComment('tkt-1', { body: 'On it' } as any, hrActor)).resolves.toBeDefined();
    });

    it('rejects a non-owner without ticket:manage', async () => {
      prisma.ticket.findUnique.mockResolvedValue({ id: 'tkt-1', employee: { userId: 'someone-else' } });

      await expect(service.addComment('tkt-1', { body: 'Nosy' } as any, employeeActor)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
