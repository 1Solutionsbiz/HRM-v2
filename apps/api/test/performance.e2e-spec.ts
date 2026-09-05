import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PasswordService } from '../src/security/password.service.js';
import { FakePrismaService } from './fakes/fake-prisma.service.js';

describe('Performance (e2e)', () => {
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
    prisma.seedPerformanceCycle({
      id: 'cyc-h2',
      name: 'H2 2026 Review Cycle',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-12-15'),
      isActive: true,
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
      permissionKeys: ['performance:manage'],
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

  it('an HR-assigned goal shows up for the employee and can be self-updated', async () => {
    const workerToken = await loginAs('worker@example.com');
    const hrToken = await loginAs('hr@example.com');
    const employeeId = [...prisma.employees.values()][0].id;

    const created = await request(app.getHttpServer())
      .post(`/performance/employees/${employeeId}/goals`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ cycleId: 'cyc-h2', title: 'Ship HRM V2 employee module' })
      .expect(201);

    const mine = await request(app.getHttpServer())
      .get('/performance/me')
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(200);
    expect(mine.body.goals).toHaveLength(1);
    expect(mine.body.goals[0].progressPercent).toBe(0);

    await request(app.getHttpServer())
      .patch(`/performance/goals/${created.body.id}/progress`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ progressPercent: 65 })
      .expect(200);

    const updated = await request(app.getHttpServer())
      .get('/performance/me')
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(200);
    expect(updated.body.goals[0].progressPercent).toBe(65);
  });

  it('rejects an employee updating progress on someone else goal (403, not silently ignored)', async () => {
    const hrToken = await loginAs('hr@example.com');
    const employeeId = [...prisma.employees.values()][0].id;

    const created = await request(app.getHttpServer())
      .post(`/performance/employees/${employeeId}/goals`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ cycleId: 'cyc-h2', title: 'Some goal' })
      .expect(201);

    // A second employee with no relation to the goal.
    const passwordHash = await new PasswordService().hash(PASSWORD);
    prisma.users.set('other-user', {
      id: 'other-user',
      email: 'other@example.com',
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
        userId: 'other-user',
        employeeCode: 'EXP-26-0002-OM',
        firstName: 'Other',
        lastName: 'Person',
        dateOfJoining: new Date('2026-01-01'),
        employmentType: 'FULL_TIME',
        departmentId: null,
        designationId: null,
        managerId: null,
      },
    });
    const otherToken = await loginAs('other@example.com');

    await request(app.getHttpServer())
      .patch(`/performance/goals/${created.body.id}/progress`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ progressPercent: 50 })
      .expect(403);
  });

  it('a conducted review and awarded recognition both surface on GET /performance/me', async () => {
    const workerToken = await loginAs('worker@example.com');
    const hrToken = await loginAs('hr@example.com');
    const employeeId = [...prisma.employees.values()][0].id;

    await request(app.getHttpServer())
      .post(`/performance/employees/${employeeId}/reviews`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ cycleId: 'cyc-h2', rating: 4.2, summary: 'Strong delivery' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/performance/employees/${employeeId}/recognitions`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ title: 'Employee of the Month', source: 'Peer nomination' })
      .expect(201);

    const mine = await request(app.getHttpServer())
      .get('/performance/me')
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(200);

    expect(mine.body.lastReview).toMatchObject({
      rating: 4.2,
      maxRating: 5,
      summary: 'Strong delivery',
    });
    expect(mine.body.recognitions).toHaveLength(1);
  });
});
