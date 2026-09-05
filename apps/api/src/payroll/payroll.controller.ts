import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { PayrollService } from './payroll.service.js';
import { ReviseSalaryDto } from './dto/revise-salary.dto.js';
import { CreatePayslipDto } from './dto/create-payslip.dto.js';

@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('salary/mine')
  getMySalary(@CurrentUser() actor: AuthContext) {
    return this.payrollService.getMySalary(actor.userId);
  }

  @Get('payslips/mine')
  getMyPayslips(@CurrentUser() actor: AuthContext) {
    return this.payrollService.getMyPayslips(actor.userId);
  }

  @Get('payslips/mine/:id')
  getMyPayslip(@Param('id') id: string, @CurrentUser() actor: AuthContext) {
    return this.payrollService.getMyPayslip(actor.userId, id);
  }

  @Get('salary/company')
  @RequirePermissions('payroll:manage')
  getCompanySalaries() {
    return this.payrollService.getCompanySalaries();
  }

  @Get('employees/:employeeId/salary')
  @RequirePermissions('payroll:manage')
  getEmployeeSalary(@Param('employeeId') employeeId: string) {
    return this.payrollService.getEmployeeSalary(employeeId);
  }

  @Post('employees/:employeeId/salary/revise')
  @RequirePermissions('payroll:manage')
  reviseSalary(
    @Param('employeeId') employeeId: string,
    @Body() dto: ReviseSalaryDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.payrollService.reviseSalary(employeeId, dto, actor);
  }

  @Get('employees/:employeeId/payslips')
  @RequirePermissions('payroll:manage')
  getEmployeePayslips(@Param('employeeId') employeeId: string) {
    return this.payrollService.getEmployeePayslips(employeeId);
  }

  @Post('employees/:employeeId/payslips')
  @RequirePermissions('payroll:manage')
  generatePayslip(
    @Param('employeeId') employeeId: string,
    @Body() dto: CreatePayslipDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.payrollService.generatePayslip(employeeId, dto, actor);
  }

  @Patch('payslips/:id/mark-paid')
  @RequirePermissions('payroll:manage')
  markPayslipPaid(@Param('id') id: string, @CurrentUser() actor: AuthContext) {
    return this.payrollService.markPayslipPaid(id, actor);
  }

  @Get('trend')
  @RequirePermissions('payroll:manage')
  getTrend() {
    return this.payrollService.getTrend();
  }

  @Get('by-department')
  @RequirePermissions('payroll:manage')
  getByDepartment(
    @Query('periodMonth') periodMonth?: string,
    @Query('periodYear') periodYear?: string,
  ) {
    return this.payrollService.getByDepartment(
      periodMonth ? Number(periodMonth) : undefined,
      periodYear ? Number(periodYear) : undefined,
    );
  }
}
