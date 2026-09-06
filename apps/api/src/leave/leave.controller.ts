import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { LeaveService } from './leave.service.js';
import { ApplyLeaveDto } from './dto/apply-leave.dto.js';
import { DecideLeaveRequestDto } from './dto/decide-leave-request.dto.js';

@Controller('leave')
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Get('types')
  getLeaveTypes() {
    return this.leaveService.getLeaveTypes();
  }

  @Get('balances')
  getBalances(@CurrentUser() actor: AuthContext) {
    return this.leaveService.getBalancesForUser(actor.userId);
  }

  @Get('ledger')
  getLedger(@CurrentUser() actor: AuthContext, @Query('year') year?: string) {
    return this.leaveService.getLedgerForUser(
      actor.userId,
      year ? Number(year) : new Date().getFullYear(),
    );
  }

  @Get('requests')
  getMyRequests(@CurrentUser() actor: AuthContext) {
    return this.leaveService.getMyRequests(actor.userId);
  }

  @Post('requests')
  applyLeave(@Body() dto: ApplyLeaveDto, @CurrentUser() actor: AuthContext) {
    return this.leaveService.applyLeave(actor.userId, dto, actor);
  }

  @Patch('requests/:id/cancel')
  cancelMyRequest(@Param('id') id: string, @CurrentUser() actor: AuthContext) {
    return this.leaveService.cancelMyRequest(actor.userId, id, actor);
  }

  @Get('requests/company')
  @RequirePermissions('leave:approve')
  getCompanyRequests() {
    return this.leaveService.getCompanyRequests();
  }

  // Before employees/:id/balances so Nest doesn't match "company" as a
  // literal employee id - same reasoning as /employees/me elsewhere.
  @Get('employees/company/balances')
  @RequirePermissions('leave:approve')
  getCompanyBalances() {
    return this.leaveService.getCompanyBalances();
  }

  @Get('employees/:id/balances')
  @RequirePermissions('leave:approve')
  getEmployeeBalances(@Param('id') id: string) {
    return this.leaveService.getBalancesForEmployee(id);
  }

  @Get('employees/:id/ledger')
  @RequirePermissions('leave:approve')
  getEmployeeLedger(@Param('id') id: string, @Query('year') year?: string) {
    return this.leaveService.getLedgerForEmployee(
      id,
      year ? Number(year) : new Date().getFullYear(),
    );
  }

  @Patch('requests/:id/decide')
  @RequirePermissions('leave:approve')
  decide(
    @Param('id') id: string,
    @Body() dto: DecideLeaveRequestDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.leaveService.decide(id, dto, actor);
  }
}
