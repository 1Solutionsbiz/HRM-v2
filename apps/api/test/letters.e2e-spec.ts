import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PasswordService } from '../src/security/password.service.js';
import { FakePrismaService } from './fakes/fake-prisma.service.js';

describe('Letters (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrismaService;
  let uploadsDir: string;
  const PASSWORD = 'CorrectHorseBattery123!';
  const previousUploadsDir = process.env.UPLOADS_DIR;

  async function loginAs(email: string) {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return response.body.accessToken as string;
  }

  beforeEach(async () => {
    uploadsDir = mkdtempSync(join(tmpdir(), 'letters-e2e-'));
    process.env.UPLOADS_DIR = uploadsDir;

    prisma = new FakePrismaService();
    prisma.seedCompanySettings();

    prisma.addRole({ id: 'role-employee', key: 'employee', label: 'Employee', permissionKeys: [] });
    prisma.addRole({
      id: 'role-hr',
      key: 'hr',
      label: 'HR',
      permissionKeys: ['letters:generate', 'letters:view', 'letters:download', 'letters:cancel'],
    });

    prisma.seedLetterCategory({ id: 'cat-1', key: 'EMPLOYMENT_LIFECYCLE', name: 'Employment Lifecycle' });
    prisma.seedLetterType({
      id: 'lt-relieving',
      key: 'RELIEVING_LETTER',
      name: 'Relieving Letter',
      categoryId: 'cat-1',
      numberPrefix: 'REL',
    });
    prisma.seedLetterSignatory({ id: 'sig-1', name: 'Atul Chaudhary', title: 'Director', isDefault: true });
    prisma.seedLetterTemplate({
      id: 'tpl-1',
      letterTypeId: 'lt-relieving',
      name: 'Standard Relieving Letter',
      currentVersionNumber: 1,
    });
    prisma.seedLetterTemplateVersion({
      id: 'v1',
      templateId: 'tpl-1',
      versionNumber: 1,
      content:
        'Dear {{employee.fullName}},\n\nThis confirms your last working day as {{custom.lastWorkingDay}}.\n\nRegards,',
    });

    const passwordHash = await new PasswordService().hash(PASSWORD);

    prisma.users.set('hr-1', {
      id: 'hr-1',
      email: 'hr@example.com',
      passwordHash,
      failedLoginCount: 0,
      lockedUntil: null,
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date(),
      employee: null,
    });
    prisma.assignRole('hr-1', 'role-hr');

    prisma.users.set('emp-user-1', {
      id: 'emp-user-1',
      email: 'worker@example.com',
      passwordHash,
      failedLoginCount: 0,
      lockedUntil: null,
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date(),
      employee: null,
    });
    prisma.assignRole('emp-user-1', 'role-employee');

    prisma.users.set('target-user-1', {
      id: 'target-user-1',
      email: 'ritika@example.com',
      passwordHash,
      failedLoginCount: 0,
      lockedUntil: null,
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date(),
      employee: null,
    });
    await prisma.employee.create({
      data: {
        userId: 'target-user-1',
        employeeCode: 'EXP-26-0002-OM',
        firstName: 'Ritika',
        lastName: 'Sharma',
        dateOfJoining: new Date('2024-03-15'),
        employmentType: 'FULL_TIME',
        departmentId: null,
        designationId: null,
        managerId: null,
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    rmSync(uploadsDir, { recursive: true, force: true });
    if (previousUploadsDir === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = previousUploadsDir;
  });

  function targetEmployeeId(): string {
    return [...prisma.employees.values()].find((e) => e.employeeCode === 'EXP-26-0002-OM')!.id;
  }

  it('rejects generating a letter for a user without letters:generate', async () => {
    const token = await loginAs('worker@example.com');

    await request(app.getHttpServer())
      .post('/letters/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        employeeId: targetEmployeeId(),
        letterTypeId: 'lt-relieving',
        customVariables: { lastWorkingDay: '2026-09-30' },
      })
      .expect(403);
  });

  it('lets HR search employees by name and finds the target employee', async () => {
    const token = await loginAs('hr@example.com');

    const results = await request(app.getHttpServer())
      .get('/letters/employees?q=Ritika')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(results.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ employeeCode: 'EXP-26-0002-OM' })]),
    );
  });

  it('rejects employee search for a user without letters:generate', async () => {
    const token = await loginAs('worker@example.com');

    await request(app.getHttpServer())
      .get('/letters/employees?q=Ritika')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('lets HR generate a letter and download the real PDF that was written to disk', async () => {
    const token = await loginAs('hr@example.com');

    const generated = await request(app.getHttpServer())
      .post('/letters/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        employeeId: targetEmployeeId(),
        letterTypeId: 'lt-relieving',
        customVariables: { lastWorkingDay: '2026-09-30' },
      })
      .expect(201);

    expect(generated.body.status).toBe('GENERATED');
    expect(generated.body.documentNumber).toMatch(/^REL\/\d{4}\/0001$/);

    const download = await request(app.getHttpServer())
      .get(`/letters/${generated.body.id}/download`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(download.headers['content-type']).toBe('application/pdf');
    expect(Buffer.from(download.body).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('rejects generation with a 400 when a required custom variable is missing', async () => {
    const token = await loginAs('hr@example.com');

    await request(app.getHttpServer())
      .post('/letters/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ employeeId: targetEmployeeId(), letterTypeId: 'lt-relieving', customVariables: {} })
      .expect(400);
  });

  it('rejects an unauthenticated download attempt', async () => {
    await request(app.getHttpServer()).get('/letters/some-id/download').expect(401);
  });

  it('lets HR cancel a generated letter, then rejects cancelling it a second time', async () => {
    const token = await loginAs('hr@example.com');

    const generated = await request(app.getHttpServer())
      .post('/letters/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        employeeId: targetEmployeeId(),
        letterTypeId: 'lt-relieving',
        customVariables: { lastWorkingDay: '2026-09-30' },
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/letters/${generated.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Issued in error' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/letters/${generated.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Issued in error' })
      .expect(409);
  });
});
