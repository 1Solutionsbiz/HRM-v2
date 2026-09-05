import { describe, expect, it, vi } from 'vitest';
import { AuditService } from './audit.service.js';

function buildPrismaMock() {
  return {
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    employee: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

describe('AuditService.getLogs', () => {
  it('resolves actorName by joining actorUserId to an Employee, over the write-time actorName/actorEmail', async () => {
    const prisma = buildPrismaMock();
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'a1',
        eventType: 'ROLE_CHANGED',
        actorUserId: 'user-1',
        actorEmail: 'admin@example.com',
        actorName: null,
        targetType: 'User',
        targetId: 'user-2',
        description: 'Roles set',
        ipAddress: null,
        occurredAt: new Date('2026-09-05T10:00:00Z'),
      },
    ]);
    prisma.employee.findMany.mockResolvedValue([
      { userId: 'user-1', firstName: 'Aditi', lastName: 'Sharma' },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AuditService(prisma as any);
    const [log] = await service.getLogs();

    expect(log.actorName).toBe('Aditi Sharma');
    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: { in: ['user-1'] } } }),
    );
  });

  it('falls back to write-time actorName, then actorEmail, then Unknown', async () => {
    const prisma = buildPrismaMock();
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'a1',
        eventType: 'LOGIN_SUCCESS',
        actorUserId: 'user-1',
        actorEmail: 'a@example.com',
        actorName: 'Written Name',
        occurredAt: new Date(),
      },
      {
        id: 'a2',
        eventType: 'LOGIN_FAILED',
        actorUserId: null,
        actorEmail: 'unrecognized@example.com',
        actorName: null,
        occurredAt: new Date(),
      },
      {
        id: 'a3',
        eventType: 'LOGIN_FAILED',
        actorUserId: null,
        actorEmail: null,
        actorName: null,
        occurredAt: new Date(),
      },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AuditService(prisma as any);
    const [byWrittenName, byEmail, unknown] = await service.getLogs();

    expect(byWrittenName.actorName).toBe('Written Name');
    expect(byEmail.actorName).toBe('unrecognized@example.com');
    expect(unknown.actorName).toBe('Unknown');
  });

  it('derives status FAILED only for LOGIN_FAILED, SUCCESS for everything else', async () => {
    const prisma = buildPrismaMock();
    prisma.auditLog.findMany.mockResolvedValue([
      { id: 'a1', eventType: 'LOGIN_FAILED', occurredAt: new Date() },
      { id: 'a2', eventType: 'ROLE_CHANGED', occurredAt: new Date() },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AuditService(prisma as any);
    const [failed, success] = await service.getLogs();

    expect(failed.status).toBe('FAILED');
    expect(success.status).toBe('SUCCESS');
  });

  it('caps the requested limit at 500 and floors it at 1', async () => {
    const prisma = buildPrismaMock();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AuditService(prisma as any);
    await service.getLogs(10000);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 }),
    );

    await service.getLogs(0);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 }),
    );
  });
});
