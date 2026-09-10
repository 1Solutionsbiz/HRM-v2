import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { readFile } from 'node:fs/promises';
import type { Request, Response } from 'express';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
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
import { avatarFilePath, avatarMulterOptions } from './avatar-upload.config.js';

// Matches exactly what avatar-upload.config.ts's filename() generates -
// also doubles as the path-traversal guard for the GET route below.
const AVATAR_FILENAME_PATTERN = /^[a-f0-9]{32}\.(?:png|jpe?g|webp)$/;
const AVATAR_CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

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

  @Post('me/avatar')
  @RequirePermissions()
  @UseInterceptors(FileInterceptor('file', avatarMulterOptions))
  uploadMyAvatar(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: Request,
    @CurrentUser() actor: AuthContext,
  ) {
    if (!file) throw new BadRequestException('No file was uploaded.');
    // Absolute, not relative: the web app calls this API from a different
    // origin (hrm.1solutions.biz vs hrm-api.1solutions.biz), so a relative
    // path would resolve against the wrong host if stored as-is.
    const url = `${request.protocol}://${request.get('host')}/employees/avatars/${file.filename}`;
    return this.employeesService.uploadMyAvatar(actor.userId, url, actor);
  }

  @Get('avatars/:filename')
  @Public()
  @RequirePermissions()
  async getAvatar(@Param('filename') filename: string, @Res() response: Response): Promise<void> {
    // @Public() bypasses JwtAuthGuard; the bare @RequirePermissions() here
    // overrides the class-level employee:manage requirement back to "no
    // permission needed" the same way the /me routes above do - otherwise
    // PermissionsGuard would still demand employee:manage since it falls
    // back to class metadata when a handler has none of its own. An
    // <img src> pointing here never carries the app's Bearer token anyway
    // (localStorage, not a cookie), so this must be reachable unauthenticated;
    // security relies on the unguessable 32-hex-char filename instead.
    if (!AVATAR_FILENAME_PATTERN.test(filename)) {
      throw new NotFoundException('Avatar not found.');
    }
    const ext = filename.split('.').pop()!;
    let buffer: Buffer;
    try {
      buffer = await readFile(avatarFilePath(filename));
    } catch {
      throw new NotFoundException('Avatar not found.');
    }
    response.setHeader('Content-Type', AVATAR_CONTENT_TYPES[ext] ?? 'application/octet-stream');
    response.send(buffer);
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
