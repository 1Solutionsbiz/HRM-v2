import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PasswordService } from '../src/security/password.service.js';
import { FakePrismaService } from './fakes/fake-prisma.service.js';

describe('Notifications (e2e)', () => {
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
    const passwordHash = await new PasswordService().hash(PASSWORD);

    for (const id of ['a', 'b']) {
      prisma.users.set(`user-${id}`, {
        id: `user-${id}`,
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

    await prisma.notification.create({
      data: {
        userId: 'user-a',
        type: 'SYSTEM',
        title: "A's notification",
        description: 'desc',
      },
    });
    await prisma.notification.create({
      data: {
        userId: 'user-b',
        type: 'SYSTEM',
        title: "B's notification",
        description: 'desc',
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

  it('only lists the caller own notifications', async () => {
    const token = await loginAs('a@example.com');

    const response = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].title).toBe("A's notification");
  });

  it('rejects marking another user notification as read (404, not 403 — no existence leak)', async () => {
    const tokenA = await loginAs('a@example.com');
    const bsNotification = [...prisma.notifications.values()].find(
      (n) => n.userId === 'user-b',
    )!;

    await request(app.getHttpServer())
      .patch(`/notifications/${bsNotification.id}/read`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);
  });

  it('marks all of the caller own notifications read without touching others', async () => {
    const tokenA = await loginAs('a@example.com');

    await request(app.getHttpServer())
      .patch('/notifications/read-all')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const aNotification = [...prisma.notifications.values()].find(
      (n) => n.userId === 'user-a',
    )!;
    const bNotification = [...prisma.notifications.values()].find(
      (n) => n.userId === 'user-b',
    )!;
    expect(aNotification.isRead).toBe(true);
    expect(bNotification.isRead).toBe(false);
  });
});
