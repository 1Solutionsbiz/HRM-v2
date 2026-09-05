import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PasswordService } from '../src/security/password.service.js';
import { FakePrismaService } from './fakes/fake-prisma.service.js';

describe('Requests (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrismaService;
  const PASSWORD = 'CorrectHorseBattery123!';

  beforeEach(async () => {
    prisma = new FakePrismaService();
    prisma.seedLeaveType({
      id: 'lt-casual',
      key: 'casual',
      name: 'Casual Leave',
      defaultAnnualDays: 12,
    });
    prisma.seedSequenceCounter('leaveRequestCode', 0);

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

  it('surfaces an applied leave request in the unified "my requests" view', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'worker@example.com', password: PASSWORD })
      .expect(200);
    const token = login.body.accessToken;

    await request(app.getHttpServer())
      .post('/leave/requests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        leaveTypeId: 'lt-casual',
        startDate: '2026-09-14',
        endDate: '2026-09-14',
        reason: 'Family function',
      })
      .expect(201);

    const result = await request(app.getHttpServer())
      .get('/requests/mine')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(result.body).toEqual([
      expect.objectContaining({
        kind: 'Leave',
        title: 'Casual Leave · Full Day',
        status: 'PENDING',
      }),
    ]);
  });

  it('rejects the unified requests view with no Authorization header', async () => {
    await request(app.getHttpServer()).get('/requests/mine').expect(401);
  });
});
