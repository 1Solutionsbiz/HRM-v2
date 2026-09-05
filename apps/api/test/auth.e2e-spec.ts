import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PasswordService } from '../src/security/password.service.js';

interface FakeUser {
  id: string;
  email: string;
  passwordHash: string;
  failedLoginCount: number;
  lockedUntil: Date | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  employee: null;
  userRoles: never[];
}

interface FakeSession {
  id: string;
  userId: string;
  deviceId: string | null;
  refreshTokenHash: string;
  ipAddress?: string;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason?: string | null;
}

/**
 * No live database in this environment — this fakes just enough of
 * PrismaService's surface for the auth flows to run end-to-end over real
 * HTTP, so these tests exercise the actual guard/pipe/filter wiring
 * (`AppModule`'s global providers), not just AuthService in isolation.
 */
class FakePrismaService {
  users = new Map<string, FakeUser>();
  sessions = new Map<string, FakeSession>();

  user = {
    findUnique: async ({
      where,
    }: {
      where: { id?: string; email?: string };
    }) => {
      if (where.id) return this.users.get(where.id) ?? null;
      if (where.email) {
        for (const user of this.users.values())
          if (user.email === where.email) return user;
      }
      return null;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<FakeUser>;
    }) => {
      const user = this.users.get(where.id);
      if (!user) throw new Error(`no fake user ${where.id}`);
      Object.assign(user, data);
      return user;
    },
    findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
      const user = this.users.get(where.id);
      if (!user) throw new Error(`no fake user ${where.id}`);
      return user;
    },
  };

  device = {
    upsert: async ({ create }: { create: Record<string, unknown> }) => ({
      id: 'device-1',
      ...create,
    }),
  };

  // Not asserted on directly — present so AuditService.log() (called on
  // every auth flow) has something to write to instead of logging a swallowed
  // failure on every request.
  auditLog = {
    create: async () => ({}),
  };

  session = {
    create: async ({
      data,
    }: {
      data: Omit<FakeSession, 'id' | 'revokedAt'>;
    }) => {
      const id = `session-${this.sessions.size + 1}`;
      const session: FakeSession = { id, revokedAt: null, ...data };
      this.sessions.set(id, session);
      return session;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<FakeSession>;
    }) => {
      const session = this.sessions.get(where.id);
      if (!session) throw new Error(`no fake session ${where.id}`);
      Object.assign(session, data);
      return session;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: {
        id?: string | { not: string };
        userId?: string;
        revokedAt?: null;
      };
      data: Partial<FakeSession>;
    }) => {
      let count = 0;
      for (const session of this.sessions.values()) {
        if (where.id !== undefined) {
          if (typeof where.id === 'object') {
            if (session.id === where.id.not) continue;
          } else if (session.id !== where.id) {
            continue;
          }
        }
        if (where.userId !== undefined && session.userId !== where.userId)
          continue;
        if (
          where.revokedAt !== undefined &&
          session.revokedAt !== where.revokedAt
        )
          continue;
        Object.assign(session, data);
        count++;
      }
      return { count };
    },
    findUnique: async ({
      where,
    }: {
      where: { id?: string; refreshTokenHash?: string };
    }) => {
      let session: FakeSession | undefined;
      if (where.id) session = this.sessions.get(where.id);
      if (where.refreshTokenHash) {
        for (const candidate of this.sessions.values()) {
          if (candidate.refreshTokenHash === where.refreshTokenHash)
            session = candidate;
        }
      }
      if (!session) return null;
      const user = this.users.get(session.userId);
      if (!user) return null;
      return {
        ...session,
        user: {
          email: user.email,
          isActive: user.isActive,
          userRoles: user.userRoles,
        },
      };
    },
  };
}

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
      employee: null,
      userRoles: [],
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
