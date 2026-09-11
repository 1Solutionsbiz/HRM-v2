import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LettersService } from './letters.service.js';
import type { AuthContext } from '../common/auth-context.js';

// generate() calls real pdfmake + real fs writes (letter-pdf.ts /
// letter-file-storage.ts) alongside the injected, mockable services below -
// mocked here so this stays a unit test (no disk I/O, no PDF rendering)
// rather than silently becoming an integration test. Real PDF generation +
// file I/O is exercised for real in test/letters.e2e-spec.ts instead.
vi.mock('./letter-pdf.js', () => ({
  generateLetterPdfBuffer: vi.fn().mockResolvedValue(Buffer.from('%PDF-fake')),
}));
vi.mock('./letter-file-storage.js', () => ({
  saveLetterPdf: vi.fn().mockResolvedValue('fake-filename.pdf'),
  letterFilePath: vi.fn((filename: string) => `/fake/uploads/letters/${filename}`),
}));

function buildPrismaMock() {
  return {
    $queryRaw: vi.fn(),
    employee: { findUnique: vi.fn(), findMany: vi.fn() },
    letterType: { findUnique: vi.fn() },
    letterCategory: { findMany: vi.fn() },
    letterTemplate: { findFirst: vi.fn(), findUnique: vi.fn() },
    letterTemplateVersion: { findUnique: vi.fn() },
    letterSignatory: { findUnique: vi.fn(), findFirst: vi.fn() },
    companySettings: { findUniqueOrThrow: vi.fn() },
    employeeLetter: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };
}

function buildService(prisma: ReturnType<typeof buildPrismaMock>) {
  const sequenceService = { nextOrCreate: vi.fn().mockResolvedValue(1) };
  const auditService = { log: vi.fn().mockResolvedValue(undefined) };
  const notificationsService = { createForEmployee: vi.fn().mockResolvedValue(undefined) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new LettersService(prisma as any, sequenceService as any, auditService as any, notificationsService as any);
  return { service, sequenceService, auditService, notificationsService };
}

const HR_ACTOR: AuthContext = {
  userId: 'user-hr',
  sessionId: 's1',
  email: 'hr@1solutions.biz',
  roles: ['hr'],
  permissions: ['letters:generate', 'letters:view', 'letters:download', 'letters:cancel'],
};

const MANAGER_ACTOR: AuthContext = {
  userId: 'user-mgr',
  sessionId: 's2',
  email: 'manager@1solutions.biz',
  roles: ['manager'],
  permissions: ['letters:generate', 'letters:view', 'letters:download', 'letters:cancel'],
};

describe('LettersService.searchEmployees', () => {
  it('lets an HR/admin actor search all active employees', async () => {
    const prisma = buildPrismaMock();
    prisma.$queryRaw.mockResolvedValue([{ id: 'emp-1' }]);
    prisma.employee.findMany.mockResolvedValue([{ id: 'emp-1', firstName: 'Ritika' }]);
    const { service } = buildService(prisma);

    const result = await service.searchEmployees(HR_ACTOR, { q: 'Ritika' });

    expect(result).toEqual([{ id: 'emp-1', firstName: 'Ritika' }]);
    const call = prisma.employee.findMany.mock.calls[0][0];
    expect(call.where.status).toBe('ACTIVE');
    expect(call.where.id).toEqual({ in: ['emp-1'] }); // narrowed by the raw-SQL term match
  });

  it('matches a search term via $queryRaw, not Prisma\'s contains filter (MariaDB collation bug)', async () => {
    // Prisma's `contains` (and even a plain $queryRaw tagged template)
    // fails against this table with MariaDB error 1267 ("Illegal mix of
    // collations") - confirmed against production. findEmployeeIdsMatchingTerm
    // must go through $queryRaw with an explicit COLLATE, and
    // employee.findMany must never receive a `contains`/`OR` text filter.
    const prisma = buildPrismaMock();
    prisma.$queryRaw.mockResolvedValue([{ id: 'emp-1' }, { id: 'emp-2' }]);
    prisma.employee.findMany.mockResolvedValue([]);
    const { service } = buildService(prisma);

    await service.searchEmployees(HR_ACTOR, { q: 'Ritika' });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const findManyArgs = prisma.employee.findMany.mock.calls[0][0];
    expect(JSON.stringify(findManyArgs)).not.toContain('contains');
    expect(findManyArgs.where.id).toEqual({ in: ['emp-1', 'emp-2'] });
  });

  it('returns an empty list without querying employees when the term matches nobody', async () => {
    const prisma = buildPrismaMock();
    prisma.$queryRaw.mockResolvedValue([]);
    const { service } = buildService(prisma);

    const result = await service.searchEmployees(HR_ACTOR, { q: 'nobody-matches-this' });

    expect(result).toEqual([]);
    expect(prisma.employee.findMany).not.toHaveBeenCalled();
  });

  it('scopes a manager (no hr/admin role) to their direct reports only', async () => {
    const prisma = buildPrismaMock();
    prisma.employee.findUnique.mockResolvedValue({ id: 'mgr-emp-1' });
    prisma.employee.findMany
      .mockResolvedValueOnce([{ id: 'report-1' }]) // resolveEmployeeScope's own lookup
      .mockResolvedValueOnce([{ id: 'report-1', firstName: 'Report One' }]); // the actual search
    const { service } = buildService(prisma);

    const result = await service.searchEmployees(MANAGER_ACTOR, {});

    expect(result).toEqual([{ id: 'report-1', firstName: 'Report One' }]);
    const searchCall = prisma.employee.findMany.mock.calls[1][0];
    expect(searchCall.where.id).toEqual({ in: ['report-1'] });
  });

  it('returns an empty list without querying when a manager has no reports', async () => {
    const prisma = buildPrismaMock();
    prisma.employee.findUnique.mockResolvedValue({ id: 'mgr-emp-1' });
    prisma.employee.findMany.mockResolvedValueOnce([]); // no reports
    const { service } = buildService(prisma);

    const result = await service.searchEmployees(MANAGER_ACTOR, {});

    expect(result).toEqual([]);
    expect(prisma.employee.findMany).toHaveBeenCalledTimes(1); // scope lookup only
  });
});

describe('LettersService.listCategories', () => {
  it('attaches each type\'s declared custom-variable keys from the code-owned whitelist', async () => {
    const prisma = buildPrismaMock();
    prisma.letterCategory.findMany.mockResolvedValue([
      {
        id: 'cat-1',
        key: 'EMPLOYMENT_LIFECYCLE',
        name: 'Employment Lifecycle',
        types: [{ id: 'lt-1', key: 'RELIEVING_LETTER', name: 'Relieving Letter', numberPrefix: 'REL', isActive: true }],
      },
    ]);
    const { service } = buildService(prisma);

    const result = await service.listCategories();

    expect(result[0].types[0].customVariables).toEqual({ required: ['lastWorkingDay'], optional: [] });
  });
});

describe('LettersService cross-employee access control', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
    // Manager's own scope: exactly one direct report, "report-1".
    prisma.employee.findUnique.mockResolvedValue({ id: 'mgr-emp-1' });
    prisma.employee.findMany.mockResolvedValue([{ id: 'report-1' }]);
  });

  it('rejects generating a letter for an employee outside the actor\'s scope', async () => {
    const { service } = buildService(prisma);

    await expect(
      service.generate(MANAGER_ACTOR, {
        employeeId: 'someone-elses-employee',
        letterTypeId: 'lt-1',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects downloading a letter belonging to an employee outside the actor\'s scope', async () => {
    prisma.employeeLetter.findUnique.mockResolvedValue({
      id: 'letter-1',
      employeeId: 'someone-elses-employee',
      fileUrl: 'abc123.pdf',
      documentNumber: 'APT/2026/0001',
    });
    const { service } = buildService(prisma);

    await expect(service.getDownload(MANAGER_ACTOR, 'letter-1')).rejects.toThrow(ForbiddenException);
  });

  it('rejects previewing a letter for an employee outside the actor\'s scope', async () => {
    const { service } = buildService(prisma);

    await expect(
      service.preview(MANAGER_ACTOR, { employeeId: 'someone-elses-employee', letterTypeId: 'lt-1' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows generation for an employee inside the actor\'s scope to proceed past the access check', async () => {
    prisma.letterType.findUnique.mockResolvedValue({
      id: 'lt-1',
      key: 'RELIEVING_LETTER',
      name: 'Relieving Letter',
      numberPrefix: 'REL',
      isActive: true,
    });
    prisma.employee.findUnique.mockImplementation((args: { where: { id?: string; userId?: string } }) => {
      if (args.where.userId) return Promise.resolve({ id: 'mgr-emp-1' });
      return Promise.resolve(null); // employee record itself not found -> NotFoundException, not Forbidden
    });
    const { service } = buildService(prisma);

    // Reaches employee-not-found (past the scope check), proving the scope
    // check itself did not block an in-scope employee.
    await expect(
      service.generate(MANAGER_ACTOR, { employeeId: 'report-1', letterTypeId: 'lt-1' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('LettersService.generate', () => {
  it('allocates a document number, renders, saves the letter, and audits the action', async () => {
    const prisma = buildPrismaMock();
    prisma.letterType.findUnique.mockResolvedValue({
      id: 'lt-1',
      key: 'RELIEVING_LETTER',
      name: 'Relieving Letter',
      numberPrefix: 'REL',
      isActive: true,
    });
    prisma.employee.findUnique.mockResolvedValue({
      id: 'emp-1',
      firstName: 'Ritika',
      lastName: 'Sharma',
      employeeCode: 'EMP-0042',
      department: { name: 'Operations' },
      designation: { title: 'Senior Analyst' },
      dateOfJoining: new Date(Date.UTC(2024, 2, 15)),
      employmentType: 'FULL_TIME',
      workLocation: 'Delhi',
      user: { email: 'ritika@1solutions.biz' },
    });
    prisma.companySettings.findUniqueOrThrow.mockResolvedValue({
      legalName: '1Solutions Pvt Ltd',
      brandName: '1Solutions',
      address: null,
      website: null,
      supportEmail: 'hr@1solutions.biz',
    });
    prisma.letterTemplate.findFirst.mockResolvedValue({
      id: 'tpl-1',
      letterTypeId: 'lt-1',
      isActive: true,
      currentVersionNumber: 1,
      signatoryId: null,
    });
    prisma.letterTemplateVersion.findUnique.mockResolvedValue({
      id: 'v1',
      templateId: 'tpl-1',
      versionNumber: 1,
      content: 'Dear {{employee.fullName}}, your last working day is {{custom.lastWorkingDay}}.',
    });
    prisma.letterSignatory.findFirst.mockResolvedValue({
      id: 'sig-1',
      name: 'Atul Chaudhary',
      title: 'Director',
    });
    prisma.employeeLetter.create.mockResolvedValue({
      id: 'letter-1',
      documentNumber: 'REL/2026/0001',
      status: 'GENERATED',
      generatedAt: new Date(),
      employeeId: 'emp-1',
    });

    const { service, sequenceService, auditService, notificationsService } = buildService(prisma);

    const result = await service.generate(HR_ACTOR, {
      employeeId: 'emp-1',
      letterTypeId: 'lt-1',
      customVariables: { lastWorkingDay: '2026-09-30' },
    });

    expect(sequenceService.nextOrCreate).toHaveBeenCalled();
    expect(prisma.employeeLetter.create).toHaveBeenCalled();
    const createArgs = prisma.employeeLetter.create.mock.calls[0][0].data;
    expect(createArgs.documentNumber).toMatch(/^REL\/\d{4}\/0001$/);
    expect(createArgs.renderedContent).toContain('Ritika Sharma');
    expect(createArgs.renderedContent).toContain('2026-09-30');
    expect(createArgs.resolvedVariables['employee.fullName']).toBe('Ritika Sharma');
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'LETTER_GENERATED' }));
    expect(notificationsService.createForEmployee).toHaveBeenCalledWith('emp-1', expect.objectContaining({ type: 'LETTER' }));
    expect(result.documentNumber).toBe('REL/2026/0001');
  });

  it('rejects generation when a required custom variable is missing', async () => {
    const prisma = buildPrismaMock();
    prisma.letterType.findUnique.mockResolvedValue({
      id: 'lt-1',
      key: 'RELIEVING_LETTER',
      name: 'Relieving Letter',
      numberPrefix: 'REL',
      isActive: true,
    });
    prisma.employee.findUnique.mockResolvedValue({
      id: 'emp-1',
      firstName: 'Ritika',
      lastName: 'Sharma',
      employeeCode: 'EMP-0042',
      department: null,
      designation: null,
      dateOfJoining: new Date(),
      employmentType: 'FULL_TIME',
      workLocation: null,
      user: { email: 'ritika@1solutions.biz' },
    });
    prisma.companySettings.findUniqueOrThrow.mockResolvedValue({
      legalName: 'X', brandName: 'X', address: null, website: null, supportEmail: 'x@x.com',
    });
    prisma.letterTemplate.findFirst.mockResolvedValue({
      id: 'tpl-1', letterTypeId: 'lt-1', isActive: true, currentVersionNumber: 1, signatoryId: null,
    });
    prisma.letterTemplateVersion.findUnique.mockResolvedValue({
      id: 'v1', templateId: 'tpl-1', versionNumber: 1,
      content: 'Last day: {{custom.lastWorkingDay}}.',
    });
    prisma.letterSignatory.findFirst.mockResolvedValue({ id: 'sig-1', name: 'X', title: 'Y' });

    const { service } = buildService(prisma);

    await expect(
      service.generate(HR_ACTOR, { employeeId: 'emp-1', letterTypeId: 'lt-1', customVariables: {} }),
    ).rejects.toThrow(/Missing required variable/);
  });
});

describe('LettersService.cancel', () => {
  it('rejects cancelling a letter that is already cancelled', async () => {
    const prisma = buildPrismaMock();
    prisma.employeeLetter.findUnique.mockResolvedValue({
      id: 'letter-1',
      employeeId: 'emp-1',
      status: 'CANCELLED',
      documentNumber: 'REL/2026/0001',
    });
    const { service } = buildService(prisma);

    await expect(
      service.cancel(HR_ACTOR, 'letter-1', { reason: 'duplicate' }),
    ).rejects.toThrow(ConflictException);
  });
});
