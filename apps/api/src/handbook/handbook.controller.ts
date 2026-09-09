import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { HandbookService } from './handbook.service.js';
import { UpdateHandbookSectionDto } from './dto/update-handbook-section.dto.js';

@Controller('handbook')
export class HandbookController {
  constructor(private readonly handbookService: HandbookService) {}

  @Get('sections')
  getAll() {
    return this.handbookService.getAll();
  }

  @Patch('sections/:id')
  @RequirePermissions('handbook:edit')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHandbookSectionDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.handbookService.update(id, dto, actor);
  }
}
