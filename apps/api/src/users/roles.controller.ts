import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Read-only here — listing roles is what a role-assignment dropdown needs.
 * Creating/editing roles and permissions is deferred to the Admin module
 * (17), which owns the "Roles & permissions" screen.
 */
@Controller('roles')
@RequirePermissions('user:manage')
export class RolesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.role.findMany({
      select: { id: true, key: true, label: true, description: true },
      orderBy: { label: 'asc' },
    });
  }
}
