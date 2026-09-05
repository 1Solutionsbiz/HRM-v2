import { Injectable, Logger } from '@nestjs/common';
import type { AuditEventType } from '../generated/prisma/enums.js';
import type { InputJsonValue } from '../generated/prisma/internal/prismaNamespace.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AuditLogEntry {
  eventType: AuditEventType;
  actorUserId?: string;
  actorEmail?: string;
  actorName?: string;
  targetType?: string;
  targetId?: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: InputJsonValue;
}

/**
 * `AuditLog` is deliberately not FK-linked to `User` (see
 * docs/database-design.md) so a row must be writable independently of the
 * identity record's lifecycle — this service is the only writer.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Decision (rule 14, documented rather than silent): a failed audit write
   * is logged and swallowed, not thrown — an audit-store outage must not
   * lock every user out of logging in or acting.
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({ data: entry });
    } catch (error) {
      this.logger.error(
        'Failed to write audit log entry',
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * Read side of module 18 (System Logs). Only `AuthService`'s login events
   * populate `actorName` on write — every other module's `.log()` call
   * (17 of them, across every module built so far) passes `actorUserId` +
   * `actorEmail` only, since `AuthContext` itself carries no name and
   * threading one through every service's audit call wasn't worth the
   * touch count. Fixed here, at the read boundary, instead: resolve a
   * display name per row by joining `actorUserId` → `Employee`, which
   * needs no change to any existing call site and is squarely this
   * module's job. Falls back to the write-time `actorName` (logins),
   * then `actorEmail`, then `'Unknown'` (an unrecognized login attempt
   * has no user to join against at all).
   */
  async getLogs(limit = 100) {
    const capped = Math.min(Math.max(limit, 1), 500);
    const logs = await this.prisma.auditLog.findMany({
      // `id` tie-breaks rows that land in the same DATETIME(3) millisecond
      // (a burst of logins, a multi-step admin action) — without it,
      // ordering among ties is whatever the storage engine feels like.
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: capped,
    });

    const actorUserIds = [
      ...new Set(
        logs
          .map((log) => log.actorUserId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const employees = actorUserIds.length
      ? await this.prisma.employee.findMany({
          where: { userId: { in: actorUserIds } },
          select: { userId: true, firstName: true, lastName: true },
        })
      : [];
    const nameByUserId = new Map(
      employees.map((employee) => [
        employee.userId,
        `${employee.firstName} ${employee.lastName}`,
      ]),
    );

    return logs.map((log) => ({
      id: log.id,
      occurredAt: log.occurredAt,
      eventType: log.eventType,
      description: log.description,
      actorName:
        (log.actorUserId && nameByUserId.get(log.actorUserId)) ||
        log.actorName ||
        log.actorEmail ||
        'Unknown',
      actorEmail: log.actorEmail,
      targetType: log.targetType,
      targetId: log.targetId,
      ipAddress: log.ipAddress,
      // Every non-login event type is only ever logged after its action
      // already succeeded — LOGIN_FAILED is the one event type that
      // represents a failure by definition, so this is read off what the
      // event type already means, not a separate invented field.
      status: log.eventType === 'LOGIN_FAILED' ? 'FAILED' : 'SUCCESS',
    }));
  }
}
