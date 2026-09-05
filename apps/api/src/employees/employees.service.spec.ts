import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { EmployeesService } from './employees.service.js';
import type { AuthContext } from '../common/auth-context.js';

function buildPrismaMock() {
  return {
    employee: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    onboardingStepTemplate: { findMany: vi.fn().mockResolvedValue([]) },
    employeeOnboardingStep: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    employeeBankDetail: { upsert: vi.fn() },
    employeeEmergencyContact: { upsert: vi.fn() },
  };
}

const actor: AuthContext = {
  userId: 'admin-1',
  sessionId: 's1',
  email: 'admin@example.com',
  roles: ['admin'],
  permissions: ['employee:manage'],
};

describe('EmployeesService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let usersService: { create: ReturnType<typeof vi.fn> };
  let encryptionService: {
    encrypt: ReturnType<typeof vi.fn>;
    decrypt: ReturnType<typeof vi.fn>;
  };
  let sequenceService: { next: ReturnType<typeof vi.fn> };
  let auditService: { log: ReturnType<typeof vi.fn> };
  let service: EmployeesService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    usersService = { create: vi.fn() };
    encryptionService = {
      encrypt: vi.fn((value: string) => `enc(${value})`),
      decrypt: vi.fn((value: string) => value.replace(/^enc\(|\)$/g, '')),
    };
    sequenceService = { next: vi.fn().mockResolvedValue(7) };
    auditService = { log: vi.fn().mockResolvedValue(undefined) };
    service = new EmployeesService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma as any,
      usersService as any,
      encryptionService as any,
      sequenceService as any,
      auditService as any,
    );
  });

  describe('create', () => {
    it('provisions the user first, generates a code, and seeds active onboarding templates', async () => {
      usersService.create.mockResolvedValue({
        id: 'user-1',
        email: 'new@example.com',
        temporaryPassword: 'temp-pass',
      });
      prisma.employee.create.mockResolvedValue({
        id: 'emp-1',
        employeeCode: 'EXP-26-0007-OM',
        firstName: 'New',
        lastName: 'Hire',
      });
      prisma.onboardingStepTemplate.findMany.mockResolvedValue([
        {
          id: 'tpl-1',
          name: 'Sign offer letter',
          sortOrder: 1,
          isActive: true,
        },
      ]);
      prisma.employee.findUnique.mockResolvedValue({
        id: 'emp-1',
        employeeCode: 'EXP-26-0007-OM',
        bankDetail: null,
      });

      const result = await service.create(
        {
          email: 'new@example.com',
          firstName: 'New',
          lastName: 'Hire',
          dateOfJoining: '2026-01-15',
        },
        actor,
      );

      expect(usersService.create).toHaveBeenCalledWith(
        { email: 'new@example.com', roleKeys: undefined },
        actor,
      );
      expect(sequenceService.next).toHaveBeenCalledWith('employeeCode');
      expect(prisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            employeeCode: 'EXP-26-0007-OM',
          }),
        }),
      );
      expect(prisma.employeeOnboardingStep.createMany).toHaveBeenCalledWith({
        data: [{ employeeId: 'emp-1', stepTemplateId: 'tpl-1' }],
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'EMPLOYEE_CREATED' }),
      );
      expect(result.temporaryPassword).toBe('temp-pass');
    });

    it('skips seeding onboarding steps when no active templates exist', async () => {
      usersService.create.mockResolvedValue({
        id: 'user-1',
        email: 'new@example.com',
        temporaryPassword: 'x',
      });
      prisma.employee.create.mockResolvedValue({ id: 'emp-1' });
      prisma.employee.findUnique.mockResolvedValue({
        id: 'emp-1',
        bankDetail: null,
      });

      await service.create(
        {
          email: 'a@b.com',
          firstName: 'A',
          lastName: 'B',
          dateOfJoining: '2026-01-01',
        },
        actor,
      );

      expect(prisma.employeeOnboardingStep.createMany).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('throws for a missing employee', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('decrypts bank detail fields', async () => {
      prisma.employee.findUnique.mockResolvedValue({
        id: 'emp-1',
        bankDetail: {
          bankName: 'Test Bank',
          accountNumberEncrypted: 'enc(123456)',
          ifscCode: 'TEST0001',
          panNumberEncrypted: 'enc(ABCDE1234F)',
        },
      });

      const result = await service.findOne('emp-1');

      expect(result.bankDetail).toEqual({
        bankName: 'Test Bank',
        accountNumber: '123456',
        ifscCode: 'TEST0001',
        panNumber: 'ABCDE1234F',
      });
    });
  });

  describe('update', () => {
    it('throws for a missing employee', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      await expect(service.update('missing', {}, actor)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('upsertBankDetail', () => {
    it('encrypts sensitive fields before writing', async () => {
      prisma.employee.findUnique
        .mockResolvedValueOnce({ id: 'emp-1' })
        .mockResolvedValueOnce({ id: 'emp-1', bankDetail: null });

      await service.upsertBankDetail(
        'emp-1',
        {
          bankName: 'Test Bank',
          accountNumber: '123456',
          ifscCode: 'TEST0001',
          panNumber: 'ABCDE1234F',
        },
        actor,
      );

      expect(encryptionService.encrypt).toHaveBeenCalledWith('123456');
      expect(encryptionService.encrypt).toHaveBeenCalledWith('ABCDE1234F');
      expect(prisma.employeeBankDetail.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            accountNumberEncrypted: 'enc(123456)',
            panNumberEncrypted: 'enc(ABCDE1234F)',
          }),
        }),
      );
    });
  });

  describe('onboarding steps', () => {
    it('throws when completing a step that does not belong to the employee', async () => {
      prisma.employeeOnboardingStep.findUnique.mockResolvedValue({
        id: 'step-1',
        employeeId: 'someone-else',
      });

      await expect(
        service.completeOnboardingStep('emp-1', 'step-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('marks a matching step complete', async () => {
      prisma.employeeOnboardingStep.findUnique.mockResolvedValue({
        id: 'step-1',
        employeeId: 'emp-1',
      });
      prisma.employeeOnboardingStep.update.mockResolvedValue({
        id: 'step-1',
        isCompleted: true,
      });

      await service.completeOnboardingStep('emp-1', 'step-1');

      expect(prisma.employeeOnboardingStep.update).toHaveBeenCalledWith({
        where: { id: 'step-1' },
        data: { isCompleted: true, completedAt: expect.any(Date) },
      });
    });
  });
});
