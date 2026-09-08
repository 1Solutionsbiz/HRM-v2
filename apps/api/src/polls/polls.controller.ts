import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { PollsService } from './polls.service.js';
import { CreatePollDto } from './dto/create-poll.dto.js';
import { VotePollDto } from './dto/vote-poll.dto.js';

@Controller('polls')
export class PollsController {
  constructor(private readonly pollsService: PollsService) {}

  @Get()
  getForEmployee(@CurrentUser() actor: AuthContext) {
    return this.pollsService.getForEmployee(actor.userId);
  }

  @Post()
  @RequirePermissions('poll:manage')
  create(@Body() dto: CreatePollDto, @CurrentUser() actor: AuthContext) {
    return this.pollsService.create(dto, actor);
  }

  @Post(':id/vote')
  vote(
    @Param('id') id: string,
    @Body() dto: VotePollDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.pollsService.vote(id, dto, actor);
  }

  @Delete(':id')
  @RequirePermissions('poll:manage')
  remove(@Param('id') id: string, @CurrentUser() actor: AuthContext) {
    return this.pollsService.remove(id, actor);
  }
}
