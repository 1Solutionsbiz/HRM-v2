import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { EmployeesService } from './employees.service.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { UpsertBankDetailDto } from './dto/upsert-bank-detail.dto.js';
import { UpsertEmergencyContactDto } from './dto/upsert-emergency-contact.dto.js';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto.js';

/**
 * Class-level employee:manage covers every route except the two /me ones
 * below, which override it back to "just logged in" via a bare
 * @RequirePermissions() — see PermissionsGuard's getAllAndOverride, method
 * metadata wins over class metadata, and an empty array short-circuits the
 * check entirely. Declared before the :id routes on purpose: Nest/Express
 * match GET/PATCH /employees/me against whichever handler is registered
 * first, and :id would otherwise swallow "me" as a literal id.
 */
@Controller('employees')
@RequirePermissions('employee:manage')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get('me')
  @RequirePermissions()
  getMe(@CurrentUser() actor: AuthContext) {
    return this.employeesService.getMe(actor.userId);
  }

  @Patch('me')
  @RequirePermissions()
  updateMe(
    @Body() dto: UpdateMyProfileDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.employeesService.updateMyProfile(actor.userId, dto, actor);
  }

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

  @Post(':id/emergency-contacts')
  addEmergencyContact(
    @Param('id') id: string,
    @Body() dto: UpsertEmergencyContactDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.employeesService.addEmergencyContact(id, dto, actor);
  }

  @Patch(':id/emergency-contacts/:contactId')
  updateEmergencyContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpsertEmergencyContactDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.employeesService.updateEmergencyContact(id, contactId, dto, actor);
  }

  @Delete(':id/emergency-contacts/:contactId')
  removeEmergencyContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.employeesService.removeEmergencyContact(id, contactId, actor);
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
