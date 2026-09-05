import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { AnnouncementsService } from './announcements.service.js';
import { PublishAnnouncementDto } from './dto/publish-announcement.dto.js';

@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  getAll(@CurrentUser() actor: AuthContext) {
    return this.announcementsService.getAllForUser(actor.userId);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(@Param('id') id: string, @CurrentUser() actor: AuthContext) {
    return this.announcementsService.markRead(actor.userId, id);
  }

  @Post()
  @RequirePermissions('announcement:publish')
  publish(
    @Body() dto: PublishAnnouncementDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.announcementsService.publish(dto, actor);
  }
}
