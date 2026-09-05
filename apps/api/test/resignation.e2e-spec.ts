import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PasswordService } from '../src/security/password.service.js';
import { FakePrismaService } from './fakes/fake-prisma.service.js';

describe('Resignation (e2e)', () => {
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
      id: 'role-hr',
      key: 'hr',
      label: 'HR',
      permissionKeys: ['resignation:decide'],
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

  function futureDate(daysFromNow: number): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + daysFromNow);
    return date.toISOString().slice(0, 10);
  }

  it('submits a resignation, then rejects a second one while pending', async () => {
    const token = await loginAs('worker@example.com');

    const submitted = await request(app.getHttpServer())
      .post('/resignations')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Relocating', lastWorkingDay: futureDate(30) })
      .expect(201);
    expect(submitted.body.status).toBe('PENDING');

    await request(app.getHttpServer())
      .post('/resignations')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Another reason', lastWorkingDay: futureDate(45) })
      .expect(409);
  });

  it('rejects an employee approving their own resignation (no resignation:decide)', async () => {
    const token = await loginAs('worker@example.com');
    await request(app.getHttpServer())
      .get('/resignations/company')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('an HR approval is reflected on GET /resignations/mine', async () => {
    const workerToken = await loginAs('worker@example.com');
    const hrToken = await loginAs('hr@example.com');

    const submitted = await request(app.getHttpServer())
      .post('/resignations')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ reason: 'Relocating', lastWorkingDay: futureDate(30) })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/resignations/${submitted.body.id}/decide`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ decision: 'APPROVED' })
      .expect(200);

    const mine = await request(app.getHttpServer())
      .get('/resignations/mine')
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(200);
    expect(mine.body[0].status).toBe('APPROVED');
  });

  it('withdrawing a pending resignation lets a new one be submitted', async () => {
    const token = await loginAs('worker@example.com');

    const submitted = await request(app.getHttpServer())
      .post('/resignations')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Relocating', lastWorkingDay: futureDate(30) })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/resignations/${submitted.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/resignations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        reason: 'Changed my mind, resigning for real',
        lastWorkingDay: futureDate(45),
      })
      .expect(201);
  });
});
