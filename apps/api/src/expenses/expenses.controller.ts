import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { ExpensesService } from './expenses.service.js';
import { SubmitExpenseClaimDto } from './dto/submit-expense-claim.dto.js';
import { DecideExpenseClaimDto } from './dto/decide-expense-claim.dto.js';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get('categories')
  getCategories() {
    return this.expensesService.getCategories();
  }

  @Get('claims')
  getMyClaims(@CurrentUser() actor: AuthContext) {
    return this.expensesService.getMyClaims(actor.userId);
  }

  @Post('claims')
  submitClaim(
    @Body() dto: SubmitExpenseClaimDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.expensesService.submitClaim(actor.userId, dto, actor);
  }

  @Patch('claims/:id/cancel')
  cancelMyClaim(@Param('id') id: string, @CurrentUser() actor: AuthContext) {
    return this.expensesService.cancelMyClaim(actor.userId, id, actor);
  }

  @Get('claims/company')
  @RequirePermissions('expense:approve')
  getCompanyClaims() {
    return this.expensesService.getCompanyClaims();
  }

  @Patch('claims/:id/decide')
  @RequirePermissions('expense:approve')
  decide(
    @Param('id') id: string,
    @Body() dto: DecideExpenseClaimDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.expensesService.decide(id, dto, actor);
  }
}
