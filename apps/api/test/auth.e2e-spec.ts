import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PasswordService } from '../src/security/password.service.js';
import { FakePrismaService } from './fakes/fake-prisma.service.js';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrismaService;
  const KNOWN_PASSWORD = 'CorrectHorseBattery123!';
  const KNOWN_EMAIL = 'aditi.sharma@1solutions.biz';

  beforeEach(async () => {
    prisma = new FakePrismaService();
    const passwordHash = await new PasswordService().hash(KNOWN_PASSWORD);
    prisma.users.set('u1', {
      id: 'u1',
      email: KNOWN_EMAIL,
      passwordHash,
      failedLoginCount: 0,
      lockedUntil: null,
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date(),
      employee: null,
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

  it('logs in with correct credentials and returns a Bearer token pair', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: KNOWN_EMAIL, password: KNOWN_PASSWORD })
      .expect(200);

    expect(response.body).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: 15 * 60,
    });
    expect(typeof response.body.accessToken).toBe('string');
    expect(typeof response.body.refreshToken).toBe('string');
  });

  it('returns the same error body for a wrong password and for an unknown email', async () => {
    const wrongPassword = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: KNOWN_EMAIL, password: 'not-the-password' })
      .expect(401);
    const unknownEmail = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'not-the-password' })
      .expect(401);

    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  it('rejects a login body with fields outside the DTO (forbidNonWhitelisted)', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: KNOWN_EMAIL, password: KNOWN_PASSWORD, isAdmin: true })
      .expect(400);
  });

  it('rejects a protected route with no Authorization header', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('rejects an access token whose session has been revoked by logout', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: KNOWN_EMAIL, password: KNOWN_PASSWORD })
      .expect(200);
    const { accessToken } = login.body;

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });

  it('rejects an already-used (rotated) refresh token', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: KNOWN_EMAIL, password: KNOWN_PASSWORD })
      .expect(200);
    const { refreshToken } = login.body;

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });
});
