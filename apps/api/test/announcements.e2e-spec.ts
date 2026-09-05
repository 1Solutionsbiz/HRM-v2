import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PasswordService } from '../src/security/password.service.js';
import { FakePrismaService } from './fakes/fake-prisma.service.js';

describe('Announcements (e2e)', () => {
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
      permissionKeys: ['announcement:publish'],
    });

    const passwordHash = await new PasswordService().hash(PASSWORD);
    for (const id of ['worker', 'hr']) {
      prisma.users.set(`${id}-1`, {
        id: `${id}-1`,
        email: `${id}@example.com`,
        passwordHash,
        failedLoginCount: 0,
        lockedUntil: null,
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
        employee: null,
      });
    }
    prisma.assignRole('worker-1', 'role-employee');
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

  it('rejects an employee publishing an announcement (no announcement:publish)', async () => {
    const token = await loginAs('worker@example.com');

    await request(app.getHttpServer())
      .post('/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'x', body: 'y', category: 'GENERAL' })
      .expect(403);
  });

  it('a published announcement shows read: false, then true after marking read — without affecting another viewer', async () => {
    const hrToken = await loginAs('hr@example.com');
    const workerToken = await loginAs('worker@example.com');

    const published = await request(app.getHttpServer())
      .post('/announcements')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        title: 'Diwali holiday schedule',
        body: 'Office closed Nov 12-13',
        category: 'HOLIDAY',
      })
      .expect(201);

    const initialForWorker = await request(app.getHttpServer())
      .get('/announcements')
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(200);
    expect(initialForWorker.body[0]).toMatchObject({ read: false });

    await request(app.getHttpServer())
      .patch(`/announcements/${published.body.id}/read`)
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(204);

    const afterForWorker = await request(app.getHttpServer())
      .get('/announcements')
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(200);
    expect(afterForWorker.body[0]).toMatchObject({ read: true });

    // Per-viewer, not global: HR's own read state is untouched by the worker marking it read.
    const forHr = await request(app.getHttpServer())
      .get('/announcements')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);
    expect(forHr.body[0]).toMatchObject({ read: false });
  });
});
