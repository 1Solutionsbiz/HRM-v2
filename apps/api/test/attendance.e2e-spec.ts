import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PasswordService } from '../src/security/password.service.js';
import { FakePrismaService } from './fakes/fake-prisma.service.js';

describe('Attendance (e2e)', () => {
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
    // Tuesday — a normal working day under the seeded policy.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T04:00:00.000Z'));

    prisma = new FakePrismaService();
    prisma.seedAttendancePolicy();

    const passwordHash = await new PasswordService().hash(PASSWORD);
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
      permissionKeys: ['attendance:manage'],
    });

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
    vi.useRealTimers();
  });

  it('checks in then rejects a second check-in the same day', async () => {
    const token = await loginAs('worker@example.com');

    const first = await request(app.getHttpServer())
      .post('/attendance/check-in')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(first.body.punchState).toBe('CHECKED_IN');

    await request(app.getHttpServer())
      .post('/attendance/check-in')
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });

  it('rejects checking out before checking in', async () => {
    const token = await loginAs('worker@example.com');

    await request(app.getHttpServer())
      .post('/attendance/check-out')
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });

  it('a full check-in/check-out cycle produces PRESENT with a nonzero worked-minutes count', async () => {
    // Access tokens are short-lived (15 min); the clock must already be at
    // the desired instant before logging in, not moved forward afterward,
    // or the token minted at login expires before check-out runs.
    const checkInAt = new Date();
    checkInAt.setHours(9, 30, 0, 0); // 09:30 local — exactly on time under the seeded policy.
    vi.setSystemTime(checkInAt);
    const checkInToken = await loginAs('worker@example.com');
    await request(app.getHttpServer())
      .post('/attendance/check-in')
      .set('Authorization', `Bearer ${checkInToken}`)
      .expect(201);

    const checkOutAt = new Date(checkInAt);
    checkOutAt.setHours(checkInAt.getHours() + 9);
    vi.setSystemTime(checkOutAt);
    const checkOutToken = await loginAs('worker@example.com');
    const result = await request(app.getHttpServer())
      .post('/attendance/check-out')
      .set('Authorization', `Bearer ${checkOutToken}`)
      .expect(201);

    expect(result.body).toMatchObject({
      punchState: 'CHECKED_OUT',
      status: 'PRESENT',
    });
    expect(result.body.workedMinutes).toBeGreaterThan(0);
  });

  it('a check-in past the grace window is reported as LATE with nonzero lateMinutes', async () => {
    const lateCheckIn = new Date();
    lateCheckIn.setHours(10, 0, 0, 0); // 30 minutes past the 09:45 grace cutoff
    vi.setSystemTime(lateCheckIn);
    const token = await loginAs('worker@example.com');

    const result = await request(app.getHttpServer())
      .post('/attendance/check-in')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(result.body.status).toBe('LATE');
    expect(result.body.lateMinutes).toBeGreaterThan(0);
  });

  it('rejects a manual correction from a user without attendance:manage', async () => {
    const token = await loginAs('worker@example.com');
    const employee = [...prisma.employees.values()][0];

    await request(app.getHttpServer())
      .post(`/attendance/employees/${employee.id}/corrections`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'CHECK_IN', occurredAt: new Date().toISOString() })
      .expect(403);
  });

  it('lets an attendance:manage holder record a correction that recomputes the day', async () => {
    const adminToken = await loginAs('admin@example.com');
    const employee = [...prisma.employees.values()][0];
    const occurredAt = new Date();
    occurredAt.setHours(9, 30, 0, 0);

    const result = await request(app.getHttpServer())
      .post(`/attendance/employees/${employee.id}/corrections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'CHECK_IN',
        occurredAt: occurredAt.toISOString(),
        note: 'Forgot to punch in',
      })
      .expect(201);

    expect(result.body.status).toBe('PRESENT');
    expect(new Date(result.body.firstCheckInAt).getTime()).toBe(
      occurredAt.getTime(),
    );
  });
});
