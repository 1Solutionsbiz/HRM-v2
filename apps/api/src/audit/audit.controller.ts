import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import { AuditService } from './audit.service.js';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @RequirePermissions('audit:view')
  getLogs(@Query('limit') limit?: string) {
    return this.auditService.getLogs(limit ? Number(limit) : undefined);
  }
}
