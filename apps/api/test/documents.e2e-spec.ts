import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PasswordService } from '../src/security/password.service.js';
import { FakePrismaService } from './fakes/fake-prisma.service.js';

describe('Documents (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrismaService;
  const PASSWORD = 'CorrectHorseBattery123!';

  async function loginAs(email: string) {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return response.body.accessToken as string;
  }

  beforeEach(async () => {
    prisma = new FakePrismaService();
    prisma.seedDocumentType({
      id: 'dt-aadhaar',
      key: 'aadhaar',
      name: 'Aadhaar card',
      category: 'IDENTITY',
    });

    prisma.addRole({
      id: 'role-employee',
      key: 'employee',
      label: 'Employee',
      permissionKeys: [],
    });
    prisma.addRole({
      id: 'role-hr',
      key: 'hr',
      label: 'HR',
      permissionKeys: ['employee:manage'],
    });

    const passwordHash = await new PasswordService().hash(PASSWORD);
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
    await prisma.employee.create({
      data: {
        userId: 'emp-user-1',
        employeeCode: 'EXP-26-0001-OM',
        firstName: 'Worker',
        lastName: 'One',
        dateOfJoining: new Date('2026-01-01'),
        employmentType: 'FULL_TIME',
        departmentId: null,
        designationId: null,
        managerId: null,
      },
    });

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

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('shows MISSING for every document type before anything is submitted', async () => {
    const token = await loginAs('worker@example.com');

    const result = await request(app.getHttpServer())
      .get('/documents/mine')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(result.body).toEqual([
      expect.objectContaining({ key: 'aadhaar', status: 'MISSING' }),
    ]);
  });

  it('submitting then HR-verifying moves the document through the full workflow', async () => {
    const workerToken = await loginAs('worker@example.com');
    const hrToken = await loginAs('hr@example.com');

    const submitted = await request(app.getHttpServer())
      .post('/documents/mine/dt-aadhaar/submit')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ fileUrl: 'https://files.example.com/aadhaar.pdf' })
      .expect(201);
    expect(submitted.body.status).toBe('PENDING_REVIEW');

    const employeeId = [...prisma.employees.values()][0].id;

    const verified = await request(app.getHttpServer())
      .patch(`/documents/employees/${employeeId}/dt-aadhaar/verify`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ decision: 'VERIFIED' })
      .expect(200);
    expect(verified.body.status).toBe('VERIFIED');

    const mine = await request(app.getHttpServer())
      .get('/documents/mine')
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(200);
    expect(mine.body[0].status).toBe('VERIFIED');
  });

  it('rejects verifying a document nobody submitted yet', async () => {
    const hrToken = await loginAs('hr@example.com');
    const employeeId = [...prisma.employees.values()][0].id;

    await request(app.getHttpServer())
      .patch(`/documents/employees/${employeeId}/dt-aadhaar/verify`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ decision: 'VERIFIED' })
      .expect(409);
  });

  it('rejects an employee verifying their own document (no employee:manage)', async () => {
    const workerToken = await loginAs('worker@example.com');
    const employeeId = [...prisma.employees.values()][0].id;

    await request(app.getHttpServer())
      .patch(`/documents/employees/${employeeId}/dt-aadhaar/verify`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ decision: 'VERIFIED' })
      .expect(403);
  });
});
