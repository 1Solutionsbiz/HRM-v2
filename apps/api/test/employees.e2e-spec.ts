import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PasswordService } from '../src/security/password.service.js';
import { FakePrismaService } from './fakes/fake-prisma.service.js';

describe('Employees (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrismaService;
  const PASSWORD = 'CorrectHorseBattery123!';

  beforeEach(async () => {
    prisma = new FakePrismaService();
    const passwordHash = await new PasswordService().hash(PASSWORD);

    prisma.addRole({
      id: 'role-admin',
      key: 'admin',
      label: 'Admin',
      permissionKeys: ['user:manage', 'employee:manage'],
    });
    prisma.addRole({
      id: 'role-employee',
      key: 'employee',
      label: 'Employee',
      permissionKeys: [],
    });
    prisma.seedSequenceCounter('employeeCode', 0);

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

  async function loginAsAdmin() {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: PASSWORD })
      .expect(200);
    return response.body.accessToken as string;
  }

  it('onboards a new employee, provisioning a User account with the default role', async () => {
    const token = await loginAsAdmin();

    const response = await request(app.getHttpServer())
      .post('/employees')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'new-hire@example.com',
        firstName: 'New',
        lastName: 'Hire',
        dateOfJoining: '2026-01-15',
      })
      .expect(201);

    expect(response.body).toMatchObject({ firstName: 'New', lastName: 'Hire' });
    expect(response.body.employeeCode).toMatch(/^EXP-\d{2}-\d{4}-OM$/);
    expect(typeof response.body.temporaryPassword).toBe('string');
  });

  it('round-trips bank details through real encryption: PUT plaintext in, GET decrypted out', async () => {
    const token = await loginAsAdmin();

    const created = await request(app.getHttpServer())
      .post('/employees')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'bank-test@example.com',
        firstName: 'Bank',
        lastName: 'Test',
        dateOfJoining: '2026-01-15',
      })
      .expect(201);
    const employeeId = created.body.id;

    await request(app.getHttpServer())
      .put(`/employees/${employeeId}/bank-detail`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        bankName: 'Test Bank',
        accountNumber: '000123456789',
        ifscCode: 'TEST0001234',
        panNumber: 'ABCDE1234F',
      })
      .expect(200);

    const detail = await request(app.getHttpServer())
      .get(`/employees/${employeeId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Asserts the value survived a real encrypt() on PUT and decrypt() on
    // GET through the actual HTTP path — not just that the service methods
    // agree with each other in isolation.
    expect(detail.body.bankDetail).toEqual({
      bankName: 'Test Bank',
      accountNumber: '000123456789',
      ifscCode: 'TEST0001234',
      panNumber: 'ABCDE1234F',
    });

    // The stored representation must never be the plaintext value.
    const stored = prisma.bankDetails.get(employeeId);
    expect(stored?.accountNumberEncrypted).not.toContain('000123456789');
  });

  it('rejects an employee-scoped route for a user with no employee:manage permission', async () => {
    const passwordHash = await new PasswordService().hash(PASSWORD);
    prisma.users.set('plain-1', {
      id: 'plain-1',
      email: 'plain@example.com',
      passwordHash,
      failedLoginCount: 0,
      lockedUntil: null,
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date(),
      employee: null,
    });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'plain@example.com', password: PASSWORD })
      .expect(200);

    await request(app.getHttpServer())
      .get('/employees')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(403);
  });
});
