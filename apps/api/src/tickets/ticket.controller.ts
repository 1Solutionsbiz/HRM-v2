import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { TicketService } from './ticket.service.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto.js';
import { AddTicketCommentDto } from './dto/add-ticket-comment.dto.js';

@Controller('tickets')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Get('mine')
  getMine(@CurrentUser() actor: AuthContext) {
    return this.ticketService.getMyTickets(actor.userId);
  }

  @Post()
  create(@Body() dto: CreateTicketDto, @CurrentUser() actor: AuthContext) {
    return this.ticketService.create(actor.userId, dto, actor);
  }

  @Get('company')
  @RequirePermissions('ticket:manage')
  getCompanyTickets() {
    return this.ticketService.getCompanyTickets();
  }

  @Patch(':id/status')
  @RequirePermissions('ticket:manage')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTicketStatusDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.ticketService.updateStatus(id, dto, actor);
  }

  @Post(':id/comments')
  addComment(
    @Param('id') id: string,
    @Body() dto: AddTicketCommentDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.ticketService.addComment(id, dto, actor);
  }
}
