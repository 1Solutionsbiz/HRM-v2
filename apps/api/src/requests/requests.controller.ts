import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { RequestsService } from './requests.service.js';

@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Get('mine')
  getMyRequests(@CurrentUser() actor: AuthContext) {
    return this.requestsService.getMyRequests(actor.userId);
  }
}
