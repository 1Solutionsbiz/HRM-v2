import { Body, Controller, Delete, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { PushSubscriptionsService } from './push-subscriptions.service.js';
import { SubscribePushDto } from './dto/subscribe-push.dto.js';

/**
 * Self-service, like NotificationsController: a person only ever manages
 * their own device subscriptions, so no `@RequirePermissions()` beyond
 * being authenticated.
 */
@Controller('push-subscriptions')
export class PushSubscriptionsController {
  constructor(private readonly pushSubscriptionsService: PushSubscriptionsService) {}

  @Post()
  subscribe(@Body() dto: SubscribePushDto, @CurrentUser() actor: AuthContext, @Req() req: Request) {
    return this.pushSubscriptionsService.subscribe(actor.userId, dto, req.headers['user-agent']);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  unsubscribe(@Query('endpoint') endpoint: string, @CurrentUser() actor: AuthContext) {
    return this.pushSubscriptionsService.unsubscribe(actor.userId, endpoint);
  }
}
