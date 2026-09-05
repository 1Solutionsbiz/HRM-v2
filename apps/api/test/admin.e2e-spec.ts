import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PasswordService } from '../src/security/password.service.js';
import { FakePrismaService } from './fakes/fake-prisma.service.js';

describe('Admin (e2e)', () => {
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
    prisma.seedCompanySettings();

    prisma.addRole({
      id: 'role-employee',
      key: 'employee',
      label: 'Employee',
      permissionKeys: [],
    });
    prisma.addRole({
      id: 'role-manager',
      key: 'manager',
      label: 'Manager',
      permissionKeys: ['leave:approve'],
    });
    prisma.addRole({
      id: 'role-admin',
      key: 'admin',
      label: 'Admin',
      permissionKeys: ['company:manage', 'user:manage'],
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

  it('rejects a worker (no company:manage/user:manage) on every admin route', async () => {
    const token = await loginAs('worker@example.com');

    await request(app.getHttpServer())
      .get('/admin/company-settings')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    await request(app.getHttpServer())
      .put('/admin/company-settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ legalName: 'x', brandName: 'x', supportEmail: 'x@example.com' })
      .expect(403);
    await request(app.getHttpServer())
      .get('/admin/roles/employees')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    // The one that actually matters: a worker must not be able to grant
    // themselves (or anyone) a higher role via this route.
    await request(app.getHttpServer())
      .patch(`/admin/roles/employees/${workerEmployeeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ roleKey: 'admin' })
      .expect(403);
  });

  it('admin reads and updates company settings, and the change persists', async () => {
    const token = await loginAs('admin@example.com');

    const before = await request(app.getHttpServer())
      .get('/admin/company-settings')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(before.body.legalName).toBe('1Solutions Pvt. Ltd.');

    await request(app.getHttpServer())
      .put('/admin/company-settings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        legalName: '1Solutions Private Limited',
        brandName: '1Solutions',
        supportEmail: 'hr@1solutions.biz',
      })
      .expect(200);

    const after = await request(app.getHttpServer())
      .get('/admin/company-settings')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(after.body.legalName).toBe('1Solutions Private Limited');
  });

  it('admin views role permissions and reassigns an employee role', async () => {
    const token = await loginAs('admin@example.com');

    const permissions = await request(app.getHttpServer())
      .get('/admin/roles/permissions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(permissions.body.manager).toEqual(['leave:approve']);

    const before = await request(app.getHttpServer())
      .get('/admin/roles/employees')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(before.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          employeeId: workerEmployeeId,
          role: 'employee',
        }),
      ]),
    );

    await request(app.getHttpServer())
      .patch(`/admin/roles/employees/${workerEmployeeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ roleKey: 'manager' })
      .expect(200);

    const after = await request(app.getHttpServer())
      .get('/admin/roles/employees')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(after.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          employeeId: workerEmployeeId,
          role: 'manager',
        }),
      ]),
    );
  });
});
