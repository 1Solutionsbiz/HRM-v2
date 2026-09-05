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
}
