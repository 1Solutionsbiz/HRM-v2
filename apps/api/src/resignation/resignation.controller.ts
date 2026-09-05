import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { ResignationService } from './resignation.service.js';
import { SubmitResignationDto } from './dto/submit-resignation.dto.js';
import { DecideResignationDto } from './dto/decide-resignation.dto.js';

@Controller('resignations')
export class ResignationController {
  constructor(private readonly resignationService: ResignationService) {}

  @Get('mine')
  getMine(@CurrentUser() actor: AuthContext) {
    return this.resignationService.getMine(actor.userId);
  }

  @Post()
  submit(@Body() dto: SubmitResignationDto, @CurrentUser() actor: AuthContext) {
    return this.resignationService.submit(actor.userId, dto, actor);
  }

  @Patch(':id/cancel')
  cancelMine(@Param('id') id: string, @CurrentUser() actor: AuthContext) {
    return this.resignationService.cancelMine(actor.userId, id, actor);
  }

  @Get('company')
  @RequirePermissions('resignation:decide')
  getCompanyResignations() {
    return this.resignationService.getCompanyResignations();
  }

  @Patch(':id/decide')
  @RequirePermissions('resignation:decide')
  decide(
    @Param('id') id: string,
    @Body() dto: DecideResignationDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.resignationService.decide(id, dto, actor);
  }
}
