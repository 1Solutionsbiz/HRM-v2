import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PasswordService } from '../src/security/password.service.js';
import { FakePrismaService } from './fakes/fake-prisma.service.js';

describe('Payroll (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrismaService;
  let workerEmployeeId: string;
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
    prisma.seedSequenceCounter('payslipCode', 0);

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
      permissionKeys: ['payroll:manage'],
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
    const worker = await prisma.employee.create({
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
    workerEmployeeId = worker.id;

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

  it('rejects an employee without payroll:manage revising salary or viewing company payroll', async () => {
    const token = await loginAs('worker@example.com');

    await request(app.getHttpServer())
      .post(`/payroll/employees/${workerEmployeeId}/salary/revise`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newAmount: 60000, effectiveDate: '2026-09-01' })
      .expect(403);

    await request(app.getHttpServer())
      .get('/payroll/salary/company')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('HR revises salary and the employee sees it reflected on their own view', async () => {
    const hrToken = await loginAs('hr@example.com');
    const workerToken = await loginAs('worker@example.com');

    const revised = await request(app.getHttpServer())
      .post(`/payroll/employees/${workerEmployeeId}/salary/revise`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        newAmount: 60000,
        effectiveDate: '2026-09-01',
        reason: 'Annual hike',
      })
      .expect(201);

    expect(revised.body.structure.currentAmount).toBe(60000);
    expect(revised.body.revision).toMatchObject({
      previousAmount: null,
      newAmount: 60000,
    });

    const mine = await request(app.getHttpServer())
      .get('/payroll/salary/mine')
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(200);

    expect(mine.body.structure.currentAmount).toBe(60000);
    expect(mine.body.revisions).toHaveLength(1);
  });

  it('generates a payslip with correct gross/net numbers, then marks it paid', async () => {
    const hrToken = await loginAs('hr@example.com');
    const workerToken = await loginAs('worker@example.com');

    const generated = await request(app.getHttpServer())
      .post(`/payroll/employees/${workerEmployeeId}/payslips`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        periodMonth: 9,
        periodYear: 2026,
        lineItems: [
          { type: 'EARNING', label: 'Basic', amount: 40000 },
          { type: 'EARNING', label: 'HRA', amount: 16000 },
          { type: 'DEDUCTION', label: 'PF', amount: 4800 },
          { type: 'DEDUCTION', label: 'Tax', amount: 3200 },
        ],
      })
      .expect(201);

    expect(generated.body.grossAmount).toBe(56000);
    expect(typeof generated.body.grossAmount).toBe('number');
    expect(generated.body.netAmount).toBe(48000);
    expect(typeof generated.body.netAmount).toBe('number');
    expect(generated.body.status).toBe('PROCESSING');
    expect(generated.body.payslipNumber).toMatch(/^PS-2026-\d{5}$/);

    const paid = await request(app.getHttpServer())
      .patch(`/payroll/payslips/${generated.body.id}/mark-paid`)
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);

    expect(paid.body.status).toBe('PAID');
    expect(paid.body.paidAt).toBeTruthy();

    const mine = await request(app.getHttpServer())
      .get('/payroll/payslips/mine')
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0].status).toBe('PAID');
  });

  it('rejects a second payslip for the same employee and period', async () => {
    const hrToken = await loginAs('hr@example.com');
    const body = {
      periodMonth: 9,
      periodYear: 2026,
      lineItems: [{ type: 'EARNING', label: 'Basic', amount: 40000 }],
    };

    await request(app.getHttpServer())
      .post(`/payroll/employees/${workerEmployeeId}/payslips`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send(body)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/payroll/employees/${workerEmployeeId}/payslips`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send(body)
      .expect(409);
  });
});
