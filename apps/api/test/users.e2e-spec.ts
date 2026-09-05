import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PasswordService } from '../src/security/password.service.js';
import { FakePrismaService } from './fakes/fake-prisma.service.js';

async function login(app: INestApplication, email: string, password: string) {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(200);
  return response.body.accessToken as string;
}

describe('Users (e2e)', () => {
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
      permissionKeys: ['user:manage'],
    });
    prisma.addRole({
      id: 'role-employee',
      key: 'employee',
      label: 'Employee',
      permissionKeys: [],
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
    // No role assigned — exercises the "authenticated but unauthorized" path.

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

  it('rejects a user with no roles from a permission-gated route (403, not a silent pass)', async () => {
    const token = await login(app, 'plain@example.com', PASSWORD);

    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'new@example.com' })
      .expect(403);
  });

  it('lets a user:manage-permitted admin create a user with the default employee role', async () => {
    const token = await login(app, 'admin@example.com', PASSWORD);

    const response = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'new-hire@example.com' })
      .expect(201);

    expect(response.body).toMatchObject({
      email: 'new-hire@example.com',
      roles: ['employee'],
    });
    expect(typeof response.body.temporaryPassword).toBe('string');
  });

  it('rejects creating a user with an unknown role key', async () => {
    const token = await login(app, 'admin@example.com', PASSWORD);

    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'new-hire@example.com', roleKeys: ['made-up-role'] })
      .expect(400);
  });

  it('deactivating a user immediately revokes their existing session', async () => {
    const adminToken = await login(app, 'admin@example.com', PASSWORD);
    const plainToken = await login(app, 'plain@example.com', PASSWORD);

    // The plain user has no permissions but is still a valid authenticated
    // session until deactivated — confirm /auth/me works before, not after.
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${plainToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch('/users/plain-1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
      .expect(200);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${plainToken}`)
      .expect(401);
  });
});
