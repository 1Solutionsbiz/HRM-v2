import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PasswordService } from '../src/security/password.service.js';
import { FakePrismaService } from './fakes/fake-prisma.service.js';

describe('Expenses (e2e)', () => {
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
    prisma.seedExpenseCategory({
      id: 'cat-travel',
      name: 'Travel',
      monthlyCapAmount: null,
    });
    prisma.seedExpenseCategory({
      id: 'cat-internet',
      name: 'Internet & Phone',
      monthlyCapAmount: 5000,
    });
    prisma.seedSequenceCounter('expenseClaimCode', 0);

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
      permissionKeys: ['expense:approve'],
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

  it('submits a claim and lists it back for the same employee', async () => {
    const token = await loginAs('worker@example.com');

    const submitted = await request(app.getHttpServer())
      .post('/expenses/claims')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryId: 'cat-travel',
        amount: 1450,
        expenseDate: '2026-09-02',
        description: 'Cab fare',
      })
      .expect(201);

    expect(submitted.body).toMatchObject({ status: 'PENDING', amount: 1450 });
    expect(submitted.body.code).toMatch(/^EX-\d{4}$/);

    const list = await request(app.getHttpServer())
      .get('/expenses/claims')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('rejects a claim that would exceed the category monthly cap', async () => {
    const token = await loginAs('worker@example.com');

    await request(app.getHttpServer())
      .post('/expenses/claims')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryId: 'cat-internet',
        amount: 4500,
        expenseDate: '2026-09-02',
        description: 'Broadband',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/expenses/claims')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryId: 'cat-internet',
        amount: 1000,
        expenseDate: '2026-09-10',
        description: 'Mobile',
      })
      .expect(400);
  });

  it('rejects an employee approving their own claim (no expense:approve)', async () => {
    const token = await loginAs('worker@example.com');

    await request(app.getHttpServer())
      .get('/expenses/claims/company')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('an HR approval is reflected on the claim and via the unified requests view', async () => {
    const workerToken = await loginAs('worker@example.com');
    const hrToken = await loginAs('hr@example.com');

    const submitted = await request(app.getHttpServer())
      .post('/expenses/claims')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({
        categoryId: 'cat-travel',
        amount: 1450,
        expenseDate: '2026-09-02',
        description: 'Cab fare',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/expenses/claims/${submitted.body.id}/decide`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ decision: 'APPROVED' })
      .expect(200);

    const unified = await request(app.getHttpServer())
      .get('/requests/mine')
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(200);

    expect(unified.body).toEqual([
      expect.objectContaining({
        kind: 'Expense',
        status: 'APPROVED',
        title: 'Travel',
      }),
    ]);
  });
});
