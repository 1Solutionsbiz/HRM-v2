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
import { WishBirthdayDto } from './dto/wish-birthday.dto.js';
import { UpsertIdentificationDto } from './dto/upsert-identification.dto.js';
import { UpsertFamilyDetailDto } from './dto/upsert-family-detail.dto.js';
import { UpsertFamilyMemberDto } from './dto/upsert-family-member.dto.js';
import { UpsertPreviousEmployerDto } from './dto/upsert-previous-employer.dto.js';

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

  // Identification / family / previous-employer / emergency-contact details
  // are employee-self-editable (unlike bank details, which stay HR-only via
  // the :id routes below) — same @RequirePermissions() override pattern and
  // same reason for being registered before the :id routes.

  @Put('me/identification')
  @RequirePermissions()
  upsertMyIdentification(
    @Body() dto: UpsertIdentificationDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.employeesService.upsertMyIdentification(actor.userId, dto, actor);
  }

  @Put('me/family-detail')
  @RequirePermissions()
  upsertMyFamilyDetail(
    @Body() dto: UpsertFamilyDetailDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.employeesService.upsertMyFamilyDetail(actor.userId, dto, actor);
  }

  @Post('me/children')
  @RequirePermissions()
  addMyChild(@Body() dto: UpsertFamilyMemberDto, @CurrentUser() actor: AuthContext) {
    return this.employeesService.addMyFamilyMember(actor.userId, 'CHILD', dto, actor);
  }

  @Patch('me/children/:memberId')
  @RequirePermissions()
  updateMyChild(
    @Param('memberId') memberId: string,
    @Body() dto: UpsertFamilyMemberDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.employeesService.updateMyFamilyMember(actor.userId, memberId, dto, actor);
  }

  @Delete('me/children/:memberId')
  @RequirePermissions()
  removeMyChild(@Param('memberId') memberId: string, @CurrentUser() actor: AuthContext) {
    return this.employeesService.removeMyFamilyMember(actor.userId, memberId, actor);
  }

  @Post('me/dependents')
  @RequirePermissions()
  addMyDependent(@Body() dto: UpsertFamilyMemberDto, @CurrentUser() actor: AuthContext) {
    return this.employeesService.addMyFamilyMember(actor.userId, 'OTHER_DEPENDENT', dto, actor);
  }

  @Patch('me/dependents/:memberId')
  @RequirePermissions()
  updateMyDependent(
    @Param('memberId') memberId: string,
    @Body() dto: UpsertFamilyMemberDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.employeesService.updateMyFamilyMember(actor.userId, memberId, dto, actor);
  }

  @Delete('me/dependents/:memberId')
  @RequirePermissions()
  removeMyDependent(@Param('memberId') memberId: string, @CurrentUser() actor: AuthContext) {
    return this.employeesService.removeMyFamilyMember(actor.userId, memberId, actor);
  }

  @Post('me/nominees')
  @RequirePermissions()
  addMyNominee(@Body() dto: UpsertFamilyMemberDto, @CurrentUser() actor: AuthContext) {
    return this.employeesService.addMyFamilyMember(actor.userId, 'NOMINEE', dto, actor);
  }

  @Patch('me/nominees/:memberId')
  @RequirePermissions()
  updateMyNominee(
    @Param('memberId') memberId: string,
    @Body() dto: UpsertFamilyMemberDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.employeesService.updateMyFamilyMember(actor.userId, memberId, dto, actor);
  }

  @Delete('me/nominees/:memberId')
  @RequirePermissions()
  removeMyNominee(@Param('memberId') memberId: string, @CurrentUser() actor: AuthContext) {
    return this.employeesService.removeMyFamilyMember(actor.userId, memberId, actor);
  }

  @Post('me/previous-employers')
  @RequirePermissions()
  addMyPreviousEmployer(
    @Body() dto: UpsertPreviousEmployerDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.employeesService.addMyPreviousEmployer(actor.userId, dto, actor);
  }

  @Patch('me/previous-employers/:employerId')
  @RequirePermissions()
  updateMyPreviousEmployer(
    @Param('employerId') employerId: string,
    @Body() dto: UpsertPreviousEmployerDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.employeesService.updateMyPreviousEmployer(actor.userId, employerId, dto, actor);
  }

  @Delete('me/previous-employers/:employerId')
  @RequirePermissions()
  removeMyPreviousEmployer(
    @Param('employerId') employerId: string,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.employeesService.removeMyPreviousEmployer(actor.userId, employerId, actor);
  }

  @Post('me/emergency-contacts')
  @RequirePermissions()
  addMyEmergencyContact(
    @Body() dto: UpsertEmergencyContactDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.employeesService.addMyEmergencyContact(actor.userId, dto, actor);
  }

  @Patch('me/emergency-contacts/:contactId')
  @RequirePermissions()
  updateMyEmergencyContact(
    @Param('contactId') contactId: string,
    @Body() dto: UpsertEmergencyContactDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.employeesService.updateMyEmergencyContact(actor.userId, contactId, dto, actor);
  }

  @Delete('me/emergency-contacts/:contactId')
  @RequirePermissions()
  removeMyEmergencyContact(
    @Param('contactId') contactId: string,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.employeesService.removeMyEmergencyContact(actor.userId, contactId, actor);
  }

  @Post()
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() actor: AuthContext) {
    return this.employeesService.create(dto, actor);
  }

  @Get()
  findAll() {
    return this.employeesService.findAll();
  }

  // Before :id for the same reason /me is — registered first so Nest
  // doesn't match "birthdays"/"anniversaries" as a literal employee id.
  // Bare @RequirePermissions() overrides: the Highlights widget these feed
  // is shown to every employee, not just employee:manage holders, and both
  // endpoints already return only what that widget needs (see each
  // service method's own comment on why it's narrow).
  @Get('birthdays')
  @RequirePermissions()
  getUpcomingBirthdays() {
    return this.employeesService.getUpcomingBirthdays();
  }

  @Get('anniversaries')
  @RequirePermissions()
  getUpcomingAnniversaries() {
    return this.employeesService.getUpcomingAnniversaries();
  }

  // Same override reasoning as birthdays/anniversaries above - every
  // employee can wish a colleague happy birthday from the Highlights
  // widget, not just employee:manage holders.
  @Post(':id/wish-birthday')
  @RequirePermissions()
  wishBirthday(
    @Param('id') id: string,
    @Body() dto: WishBirthdayDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.employeesService.wishBirthday(id, dto, actor);
  }

  // Class-level employee:manage applies (no override) - this is the
  // People > Onboarding roster, HR/admin only, unlike birthdays/anniversaries
  // above. Registered before :id for the same reason as /me.
  @Get('onboarding')
  getOnboardingRoster() {
    return this.employeesService.getOnboardingRoster();
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
