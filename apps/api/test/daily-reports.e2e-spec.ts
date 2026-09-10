import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PasswordService } from '../src/security/password.service.js';
import { FakePrismaService } from './fakes/fake-prisma.service.js';

describe('Daily Reports (e2e)', () => {
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

  async function makeUserAndEmployee(opts: {
    userId: string;
    email: string;
    employeeCode: string;
    firstName: string;
    managerId?: string | null;
    roleKey?: string;
  }) {
    const passwordHash = await new PasswordService().hash(PASSWORD);
    prisma.users.set(opts.userId, {
      id: opts.userId,
      email: opts.email,
      passwordHash,
      failedLoginCount: 0,
      lockedUntil: null,
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date(),
      employee: null,
    });
    if (opts.roleKey) prisma.assignRole(opts.userId, `role-${opts.roleKey}`);
    const employee = await prisma.employee.create({
      data: {
        userId: opts.userId,
        employeeCode: opts.employeeCode,
        firstName: opts.firstName,
        lastName: 'Test',
        dateOfJoining: new Date('2026-01-01'),
        employmentType: 'FULL_TIME',
        departmentId: null,
        designationId: null,
        managerId: opts.managerId ?? null,
      },
    });
    return employee;
  }

  beforeEach(async () => {
    prisma = new FakePrismaService();
    prisma.seedCompanySettings({ dailyReportRequired: false });
    prisma.seedAttendancePolicy();

    prisma.addRole({ id: 'role-employee', key: 'employee', label: 'Employee', permissionKeys: [] });
    prisma.addRole({
      id: 'role-manager',
      key: 'manager',
      label: 'Manager',
      permissionKeys: ['performance:manage'],
    });
    prisma.addRole({ id: 'role-hr', key: 'hr', label: 'HR', permissionKeys: ['performance:manage'] });
    prisma.addRole({ id: 'role-admin', key: 'admin', label: 'Admin', permissionKeys: ['performance:manage'] });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('an employee can view and submit their own report', async () => {
    await makeUserAndEmployee({ userId: 'u-worker', email: 'worker@example.com', employeeCode: 'EXP-1', firstName: 'Worker' });
    const token = await loginAs('worker@example.com');

    await request(app.getHttpServer())
      .get('/daily-reports/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .put('/daily-reports/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ summary: 'Worked on onboarding docs', tasks: [{ title: 'Draft README', status: 'COMPLETED' }] })
      .expect(200);
  });

  it('an employee cannot view another employee\'s report (403)', async () => {
    await makeUserAndEmployee({ userId: 'u-worker', email: 'worker@example.com', employeeCode: 'EXP-1', firstName: 'Worker' });
    const other = await makeUserAndEmployee({ userId: 'u-other', email: 'other@example.com', employeeCode: 'EXP-2', firstName: 'Other' });
    const token = await loginAs('worker@example.com');

    await request(app.getHttpServer())
      .get(`/daily-reports/employees/${other.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it("a manager can view their own direct report's daily report", async () => {
    const manager = await makeUserAndEmployee({
      userId: 'u-manager', email: 'manager@example.com', employeeCode: 'EXP-M', firstName: 'Manager', roleKey: 'manager',
    });
    const report = await makeUserAndEmployee({
      userId: 'u-report', email: 'report@example.com', employeeCode: 'EXP-R', firstName: 'Report', managerId: manager.id,
    });
    const managerToken = await loginAs('manager@example.com');

    await request(app.getHttpServer())
      .get(`/daily-reports/employees/${report.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);
  });

  it("a manager cannot view an employee outside their team (403)", async () => {
    const manager = await makeUserAndEmployee({
      userId: 'u-manager', email: 'manager@example.com', employeeCode: 'EXP-M', firstName: 'Manager', roleKey: 'manager',
    });
    const unrelated = await makeUserAndEmployee({
      userId: 'u-unrelated', email: 'unrelated@example.com', employeeCode: 'EXP-U', firstName: 'Unrelated', managerId: null,
    });
    void manager;
    const managerToken = await loginAs('manager@example.com');

    await request(app.getHttpServer())
      .get(`/daily-reports/employees/${unrelated.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(403);
  });

  it("a manager's team roster only includes their own direct reports", async () => {
    const manager = await makeUserAndEmployee({
      userId: 'u-manager', email: 'manager@example.com', employeeCode: 'EXP-M', firstName: 'Manager', roleKey: 'manager',
    });
    await makeUserAndEmployee({
      userId: 'u-report', email: 'report@example.com', employeeCode: 'EXP-R', firstName: 'Report', managerId: manager.id,
    });
    await makeUserAndEmployee({
      userId: 'u-unrelated', email: 'unrelated@example.com', employeeCode: 'EXP-U', firstName: 'Unrelated', managerId: null,
    });
    const managerToken = await loginAs('manager@example.com');

    const res = await request(app.getHttpServer())
      .get('/daily-reports/team')
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].employee.firstName).toBe('Report');
  });

  it('HR has organisation-wide access, including employees with no manager set', async () => {
    await makeUserAndEmployee({ userId: 'u-hr', email: 'hr@example.com', employeeCode: 'EXP-HR', firstName: 'HR', roleKey: 'hr' });
    const unrelated = await makeUserAndEmployee({
      userId: 'u-unrelated', email: 'unrelated@example.com', employeeCode: 'EXP-U', firstName: 'Unrelated', managerId: null,
    });
    const hrToken = await loginAs('hr@example.com');

    await request(app.getHttpServer())
      .get(`/daily-reports/employees/${unrelated.id}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);

    const roster = await request(app.getHttpServer())
      .get('/daily-reports/team')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);
    expect(roster.body.length).toBeGreaterThanOrEqual(2); // HR themself + the unrelated employee
  });

  it('Admin has organisation-wide access', async () => {
    await makeUserAndEmployee({ userId: 'u-admin', email: 'admin@example.com', employeeCode: 'EXP-A', firstName: 'Admin', roleKey: 'admin' });
    const someone = await makeUserAndEmployee({
      userId: 'u-someone', email: 'someone@example.com', employeeCode: 'EXP-S', firstName: 'Someone', managerId: null,
    });
    const adminToken = await loginAs('admin@example.com');

    await request(app.getHttpServer())
      .get(`/daily-reports/employees/${someone.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('rejects an unauthenticated request with no token (401)', async () => {
    await request(app.getHttpServer()).get('/daily-reports/me').expect(401);
  });

  it('rejects a plain employee hitting the manager/HR team roster (403)', async () => {
    await makeUserAndEmployee({ userId: 'u-worker', email: 'worker@example.com', employeeCode: 'EXP-1', firstName: 'Worker' });
    const token = await loginAs('worker@example.com');

    await request(app.getHttpServer())
      .get('/daily-reports/team')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it("HR can excuse a manager-scoped employee's missing report with a mandatory reason, and it's rejected without one", async () => {
    prisma.seedCompanySettings({
      dailyReportRequired: true,
      dailyReportDeadline: new Date(Date.UTC(1970, 0, 1, 9, 0, 0)),
      dailyReportGraceMinutes: 0,
    });
    await makeUserAndEmployee({ userId: 'u-hr', email: 'hr@example.com', employeeCode: 'EXP-HR', firstName: 'HR', roleKey: 'hr' });
    const worker = await makeUserAndEmployee({
      userId: 'u-worker', email: 'worker@example.com', employeeCode: 'EXP-1', firstName: 'Worker',
    });
    const hrToken = await loginAs('hr@example.com');

    // A working day in the past is unconditionally past its deadline+grace,
    // regardless of what time "now" happens to be when this test runs.
    const pastDate = '2020-01-06'; // a Monday

    await request(app.getHttpServer())
      .post(`/daily-reports/employees/${worker.id}/excuse`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ date: pastDate })
      .expect(400); // reason is required by the DTO

    await request(app.getHttpServer())
      .post(`/daily-reports/employees/${worker.id}/excuse`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ date: pastDate, reason: 'Confirmed present via manager, form was overlooked' })
      .expect(201);

    const after = await request(app.getHttpServer())
      .get(`/daily-reports/employees/${worker.id}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .query({ date: pastDate })
      .expect(200);
    expect(after.body.status).toBe('EXCUSED');
  });
});
