import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PasswordService } from '../src/security/password.service.js';
import { FakePrismaService } from './fakes/fake-prisma.service.js';

describe('Audit (e2e)', () => {
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

    prisma.addRole({
      id: 'role-employee',
      key: 'employee',
      label: 'Employee',
      permissionKeys: [],
    });
    prisma.addRole({
      id: 'role-admin',
      key: 'admin',
      label: 'Admin',
      permissionKeys: ['audit:view'],
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

    prisma.users.set('admin-1', {
      id: 'admin-1',
      email: 'admin@example.com',
      passwordHash,
      failedLoginCount: 0,
      lockedUntil: null,
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date(),
      employee: null,
    });
    prisma.assignRole('admin-1', 'role-admin');

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

  it('rejects a worker without audit:view', async () => {
    const token = await loginAs('worker@example.com');
    await request(app.getHttpServer())
      .get('/audit/logs')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('an admin sees their own login logged, with a real name resolved from their Employee record, most recent first', async () => {
    // A wrong password first, to also produce a LOGIN_FAILED row and prove
    // status is derived correctly end to end.
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'worker@example.com', password: 'wrong-password' })
      .expect(401);

    await loginAs('worker@example.com');
    const adminToken = await loginAs('admin@example.com');
    const result = await request(app.getHttpServer())
      .get('/audit/logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(result.body[0].eventType).toBe('LOGIN_SUCCESS'); // admin's own just-completed login, most recent
    const failedRow = result.body.find(
      (row: { eventType: string }) => row.eventType === 'LOGIN_FAILED',
    );
    expect(failedRow.status).toBe('FAILED');
    const workerLoginRow = result.body.find(
      (row: { eventType: string; actorEmail: string }) =>
        row.eventType === 'LOGIN_SUCCESS' &&
        row.actorEmail === 'worker@example.com',
    );
    expect(workerLoginRow.actorName).toBe('Worker One');
  });
});
