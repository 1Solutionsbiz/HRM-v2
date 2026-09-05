import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PasswordService } from '../src/security/password.service.js';
import { FakePrismaService } from './fakes/fake-prisma.service.js';

describe('Leave (e2e)', () => {
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
    prisma.seedLeaveType({
      id: 'lt-casual',
      key: 'casual',
      name: 'Casual Leave',
      defaultAnnualDays: 12,
    });
    prisma.seedSequenceCounter('leaveRequestCode', 0);

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
      permissionKeys: ['leave:approve'],
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

  it('applies for leave and lists it back for the same employee', async () => {
    const token = await loginAs('worker@example.com');

    const applied = await request(app.getHttpServer())
      .post('/leave/requests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        leaveTypeId: 'lt-casual',
        startDate: '2026-09-14',
        endDate: '2026-09-14',
        reason: 'Family function',
      })
      .expect(201);

    expect(applied.body).toMatchObject({ status: 'PENDING', totalDays: 1 });
    expect(applied.body.code).toMatch(/^LV-\d{4}$/);

    const list = await request(app.getHttpServer())
      .get('/leave/requests')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('rejects a request without employee:manage-equivalent permission from approving (403)', async () => {
    const token = await loginAs('worker@example.com');

    await request(app.getHttpServer())
      .get('/leave/requests/company')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('an HR approval marks the covered AttendanceDay ON_LEAVE and is reflected in the balance', async () => {
    const workerToken = await loginAs('worker@example.com');
    const hrToken = await loginAs('hr@example.com');

    const applied = await request(app.getHttpServer())
      .post('/leave/requests')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({
        leaveTypeId: 'lt-casual',
        startDate: '2026-09-14',
        endDate: '2026-09-14',
        reason: 'Family function',
      })
      .expect(201);

    const decided = await request(app.getHttpServer())
      .patch(`/leave/requests/${applied.body.id}/decide`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ decision: 'APPROVED' })
      .expect(200);
    expect(decided.body.status).toBe('APPROVED');

    const employee = [...prisma.employees.values()][0];
    const day = [...prisma.attendanceDays.values()].find(
      (d) => d.employeeId === employee.id,
    );
    expect(day?.status).toBe('ON_LEAVE');
    expect(day?.leaveRequestId).toBe(applied.body.id);

    const balances = await request(app.getHttpServer())
      .get('/leave/balances')
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(200);
    const casual = balances.body.find(
      (b: { leaveTypeKey: string }) => b.leaveTypeKey === 'casual',
    );
    expect(casual.usedDays).toBe(1);
    expect(casual.remainingDays).toBe(11);
  });

  it('rejects a self-cancel of an already-approved request', async () => {
    const workerToken = await loginAs('worker@example.com');
    const hrToken = await loginAs('hr@example.com');

    const applied = await request(app.getHttpServer())
      .post('/leave/requests')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({
        leaveTypeId: 'lt-casual',
        startDate: '2026-09-14',
        endDate: '2026-09-14',
        reason: 'x',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/leave/requests/${applied.body.id}/decide`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ decision: 'APPROVED' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/leave/requests/${applied.body.id}/cancel`)
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(409);
  });
});
