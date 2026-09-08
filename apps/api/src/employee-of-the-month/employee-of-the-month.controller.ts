import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { EmployeeOfTheMonthService } from './employee-of-the-month.service.js';
import { NominateEmployeeOfTheMonthDto } from './dto/nominate-employee-of-the-month.dto.js';

@Controller('employee-of-the-month')
export class EmployeeOfTheMonthController {
  constructor(
    private readonly employeeOfTheMonthService: EmployeeOfTheMonthService,
  ) {}

  @Get('current')
  getCurrent() {
    return this.employeeOfTheMonthService.getCurrent();
  }

  @Post()
  @RequirePermissions('recognition:manage')
  nominate(
    @Body() dto: NominateEmployeeOfTheMonthDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.employeeOfTheMonthService.nominate(dto, actor);
  }
}
