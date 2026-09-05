import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { EmployeesService } from './employees.service.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { UpsertBankDetailDto } from './dto/upsert-bank-detail.dto.js';
import { UpsertEmergencyContactDto } from './dto/upsert-emergency-contact.dto.js';

/**
 * No self-service scope yet ("my own profile") — every route here requires
 * employee:manage. A future `/employees/me` for the Profile screen is a
 * separate, deliberately unbuilt concern (it needs "read your own record"
 * authorization, not "manage everyone's").
 */
@Controller('employees')
@RequirePermissions('employee:manage')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() actor: AuthContext) {
    return this.employeesService.create(dto, actor);
  }

  @Get()
  findAll() {
    return this.employeesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.employeesService.update(id, dto, actor);
  }

  @Put(':id/bank-detail')
  upsertBankDetail(
    @Param('id') id: string,
    @Body() dto: UpsertBankDetailDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.employeesService.upsertBankDetail(id, dto, actor);
  }

  @Put(':id/emergency-contact')
  upsertEmergencyContact(
    @Param('id') id: string,
    @Body() dto: UpsertEmergencyContactDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.employeesService.upsertEmergencyContact(id, dto, actor);
  }

  @Get(':id/onboarding-steps')
  listOnboardingSteps(@Param('id') id: string) {
    return this.employeesService.listOnboardingSteps(id);
  }

  @Patch(':id/onboarding-steps/:stepId/complete')
  completeOnboardingStep(
    @Param('id') id: string,
    @Param('stepId') stepId: string,
  ) {
    return this.employeesService.completeOnboardingStep(id, stepId);
  }
}
