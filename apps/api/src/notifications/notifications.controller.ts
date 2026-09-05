import { Controller, Get, Param, Patch } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@CurrentUser() actor: AuthContext) {
    return this.notificationsService.findAllForUser(actor.userId);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() actor: AuthContext) {
    return this.notificationsService.markRead(actor.userId, id);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() actor: AuthContext) {
    return this.notificationsService.markAllRead(actor.userId);
  }
}
