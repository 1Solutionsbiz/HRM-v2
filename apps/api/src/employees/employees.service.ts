import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EncryptionService } from '../security/encryption.service.js';
import { SequenceService } from '../sequence/sequence.service.js';
import { AuditService } from '../audit/audit.service.js';
import { UsersService } from '../users/users.service.js';
import type { AuthContext } from '../common/auth-context.js';
import type { CreateEmployeeDto } from './dto/create-employee.dto.js';
import type { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import type { UpsertBankDetailDto } from './dto/upsert-bank-detail.dto.js';
import type { UpsertEmergencyContactDto } from './dto/upsert-emergency-contact.dto.js';

const EMPLOYEE_INCLUDE = {
  department: true,
  designation: true,
  manager: { select: { id: true, firstName: true, lastName: true } },
  emergencyContact: true,
  bankDetail: true,
} as const;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly encryptionService: EncryptionService,
    private readonly sequenceService: SequenceService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateEmployeeDto, actor: AuthContext) {
    // Provisions the auth account first — Employee.userId is required, so
    // there is no valid intermediate state without one. The temp password
    // UsersService generates is relayed straight through in the response
    // (still no email delivery); the audit trail links both rows via the
    // shared user id in targetId.
    const { id: userId, temporaryPassword } = await this.usersService.create(
      { email: dto.email, roleKeys: dto.roleKeys },
      actor,
    );

    const dateOfJoining = new Date(dto.dateOfJoining);
    const employeeCode = await this.generateEmployeeCode(dateOfJoining);

    const employee = await this.prisma.employee.create({
      data: {
        userId,
        employeeCode,
        firstName: dto.firstName,
        lastName: dto.lastName,
        personalEmail: dto.personalEmail,
        phone: dto.phone,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        dateOfJoining,
        employmentType: dto.employmentType,
        workLocation: dto.workLocation,
        currentAddress: dto.currentAddress,
        departmentId: dto.departmentId,
        designationId: dto.designationId,
        managerId: dto.managerId,
      },
    });

    await this.seedOnboardingSteps(employee.id);

    await this.auditService.log({
      eventType: 'EMPLOYEE_CREATED',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'User',
      targetId: userId,
      description: `Created employee ${employee.firstName} ${employee.lastName} (${employee.employeeCode})`,
      metadata: { employeeId: employee.id },
    });

    const detail = await this.findOne(employee.id);
    return { ...detail, temporaryPassword };
  }

  async findAll() {
    // Employee.status is ACTIVE/INACTIVE only — the mock directory's third
    // "On Leave" value is a derived fact (an approved LeaveRequest covering
    // today), not a column. That derivation belongs to the Leave module
    // (06), not built yet; this deliberately does not fake a third status
    // value in the meantime. See docs/database-design.md.
    return this.prisma.employee.findMany({
      include: {
        department: true,
        designation: true,
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: EMPLOYEE_INCLUDE,
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return this.serialize(employee);
  }

  async update(id: string, dto: UpdateEmployeeDto, actor: AuthContext) {
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Employee not found');

    await this.prisma.employee.update({
      where: { id },
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    });

    await this.auditService.log({
      eventType: 'EMPLOYEE_UPDATED',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Employee',
      targetId: id,
      description: `Updated employee profile for ${existing.firstName} ${existing.lastName}`,
    });

    return this.findOne(id);
  }

  async upsertBankDetail(
    id: string,
    dto: UpsertBankDetailDto,
    actor: AuthContext,
  ) {
    await this.assertExists(id);

    const accountNumberEncrypted = this.encryptionService.encrypt(
      dto.accountNumber,
    );
    const panNumberEncrypted = dto.panNumber
      ? this.encryptionService.encrypt(dto.panNumber)
      : null;

    await this.prisma.employeeBankDetail.upsert({
      where: { employeeId: id },
      create: {
        employeeId: id,
        bankName: dto.bankName,
        accountNumberEncrypted,
        ifscCode: dto.ifscCode,
        panNumberEncrypted,
      },
      update: {
        bankName: dto.bankName,
        accountNumberEncrypted,
        ifscCode: dto.ifscCode,
        panNumberEncrypted,
      },
    });

    await this.auditService.log({
      eventType: 'EMPLOYEE_UPDATED',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Employee',
      targetId: id,
      description: 'Bank details updated',
    });

    return this.findOne(id);
  }

  async upsertEmergencyContact(
    id: string,
    dto: UpsertEmergencyContactDto,
    actor: AuthContext,
  ) {
    await this.assertExists(id);

    await this.prisma.employeeEmergencyContact.upsert({
      where: { employeeId: id },
      create: { employeeId: id, ...dto },
      update: { ...dto },
    });

    await this.auditService.log({
      eventType: 'EMPLOYEE_UPDATED',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Employee',
      targetId: id,
      description: 'Emergency contact updated',
    });

    return this.findOne(id);
  }

  async listOnboardingSteps(employeeId: string) {
    await this.assertExists(employeeId);
    return this.prisma.employeeOnboardingStep.findMany({
      where: { employeeId },
      include: { stepTemplate: true },
      orderBy: { stepTemplate: { sortOrder: 'asc' } },
    });
  }

  async completeOnboardingStep(employeeId: string, stepId: string) {
    const step = await this.prisma.employeeOnboardingStep.findUnique({
      where: { id: stepId },
    });
    if (!step || step.employeeId !== employeeId) {
      throw new NotFoundException(
        'Onboarding step not found for this employee',
      );
    }
    return this.prisma.employeeOnboardingStep.update({
      where: { id: stepId },
      data: { isCompleted: true, completedAt: new Date() },
    });
  }

  private async seedOnboardingSteps(employeeId: string): Promise<void> {
    const templates = await this.prisma.onboardingStepTemplate.findMany({
      where: { isActive: true },
    });
    if (templates.length === 0) return;
    await this.prisma.employeeOnboardingStep.createMany({
      data: templates.map((template) => ({
        employeeId,
        stepTemplateId: template.id,
      })),
    });
  }

  private async assertExists(id: string): Promise<void> {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
  }

  /**
   * UNKNOWN, documented rather than silently assumed (rule 14): the mock
   * directory's sample codes (e.g. "EXP-24-0118-OM") show the shape but not
   * the confirmed meaning of "OM" or whether the sequence resets yearly —
   * this reproduces the visible shape (join-year + a global atomic sequence)
   * and needs sign-off from whoever owns the real convention.
   */
  private async generateEmployeeCode(dateOfJoining: Date): Promise<string> {
    const year = dateOfJoining.getUTCFullYear() % 100;
    const sequence = await this.sequenceService.next('employeeCode');
    return `EXP-${String(year).padStart(2, '0')}-${String(sequence).padStart(4, '0')}-OM`;
  }

  private serialize(employee: {
    bankDetail: {
      bankName: string;
      accountNumberEncrypted: string;
      ifscCode: string;
      panNumberEncrypted: string | null;
    } | null;
    [key: string]: unknown;
  }) {
    const { bankDetail, ...rest } = employee;
    return {
      ...rest,
      bankDetail: bankDetail
        ? {
            bankName: bankDetail.bankName,
            accountNumber: this.encryptionService.decrypt(
              bankDetail.accountNumberEncrypted,
            ),
            ifscCode: bankDetail.ifscCode,
            panNumber: bankDetail.panNumberEncrypted
              ? this.encryptionService.decrypt(bankDetail.panNumberEncrypted)
              : null,
          }
        : null,
    };
  }
}
