import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { OperatingExpensesService } from './operating-expenses.service.js';
import { UpsertOperatingExpenseDto } from './dto/upsert-operating-expense.dto.js';

@Controller('operating-expenses')
@RequirePermissions('payroll:manage')
export class OperatingExpensesController {
  constructor(
    private readonly operatingExpensesService: OperatingExpensesService,
  ) {}

  @Get()
  getForPeriod(
    @Query('periodMonth') periodMonth?: string,
    @Query('periodYear') periodYear?: string,
  ) {
    return this.operatingExpensesService.getForPeriod(
      periodMonth ? Number(periodMonth) : undefined,
      periodYear ? Number(periodYear) : undefined,
    );
  }

  @Post()
  upsert(
    @Body() dto: UpsertOperatingExpenseDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.operatingExpensesService.upsert(dto, actor);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor: AuthContext) {
    return this.operatingExpensesService.remove(id, actor);
  }
}
