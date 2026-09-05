import { createHash, randomBytes } from 'node:crypto';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service.js';
import { PasswordService } from '../security/password.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthContext } from '../common/auth-context.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RefreshTokenDto } from './dto/refresh-token.dto.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * New requirements — legacy had no lockout or rate limiting at all (rule 13
 * doesn't apply; there was no existing policy to inspect).
 */
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

const GENERIC_LOGIN_ERROR = 'Invalid email or password';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly auditService: AuditService,
  ) {}

  async login(dto: LoginDto, meta: RequestMeta): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { employee: { select: { firstName: true, lastName: true } } },
    });

    if (!user) {
      // Same cost and same error as a real user with a wrong password, so
      // response timing/content never reveals whether the email exists.
      await this.passwordService.simulateVerification();
      await this.auditService.log({
        eventType: 'LOGIN_FAILED',
        actorEmail: dto.email,
        description: 'Login attempt for an email with no account',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.auditService.log({
        eventType: 'LOGIN_FAILED',
        actorUserId: user.id,
        actorEmail: user.email,
        description: 'Login attempt while account is locked',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      // Specific message is acceptable here: this is an internal,
      // admin-provisioned system with no open signup, so it isn't aiding
      // account enumeration the way it would on a public consumer app.
      throw new UnauthorizedException(
        'Account is temporarily locked after repeated failed attempts. Try again later.',
      );
    }

    if (!user.isActive) {
      await this.passwordService.simulateVerification();
      await this.auditService.log({
        eventType: 'LOGIN_FAILED',
        actorUserId: user.id,
        actorEmail: user.email,
        description: 'Login attempt on an inactive account',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    const passwordValid = await this.passwordService.verify(
      dto.password,
      user.passwordHash,
    );
    if (!passwordValid) {
      const failedLoginCount = user.failedLoginCount + 1;
      const shouldLock = failedLoginCount >= LOCKOUT_THRESHOLD;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: shouldLock ? 0 : failedLoginCount,
          lockedUntil: shouldLock
            ? new Date(Date.now() + LOCKOUT_DURATION_MS)
            : null,
        },
      });
      await this.auditService.log({
        eventType: 'LOGIN_FAILED',
        actorUserId: user.id,
        actorEmail: user.email,
        description: shouldLock
          ? 'Account locked after repeated failed logins'
          : 'Incorrect password',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    let deviceId: string | undefined;
    if (dto.deviceFingerprint) {
      const device = await this.prisma.device.upsert({
        where: {
          userId_fingerprint: {
            userId: user.id,
            fingerprint: dto.deviceFingerprint,
          },
        },
        create: {
          userId: user.id,
          fingerprint: dto.deviceFingerprint,
          label: dto.deviceLabel,
          userAgent: meta.userAgent,
        },
        update: {
          lastSeenAt: new Date(),
          ...(dto.deviceLabel ? { label: dto.deviceLabel } : {}),
          ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
        },
      });
      deviceId = device.id;
    }

    const tokens = await this.issueTokens(user.id, deviceId, meta.ipAddress);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const actorName = user.employee
      ? `${user.employee.firstName} ${user.employee.lastName}`
      : undefined;
    await this.auditService.log({
      eventType: 'LOGIN_SUCCESS',
      actorUserId: user.id,
      actorEmail: user.email,
      actorName,
      description: 'Login succeeded',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return tokens;
  }

  async refresh(dto: RefreshTokenDto, meta: RequestMeta): Promise<TokenPair> {
    const refreshTokenHash = this.hashToken(dto.refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash },
      include: { user: { select: { isActive: true } } },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt < new Date() ||
      !session.user.isActive
    ) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    // Rotation: the presented token is single-use. Revoking it before
    // issuing the replacement means a stolen-and-replayed old token can
    // never mint a second valid session from the same one.
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), revokedReason: 'ROTATED' },
    });

    return this.issueTokens(
      session.userId,
      session.deviceId ?? undefined,
      meta.ipAddress,
    );
  }

  async logout(authContext: AuthContext, meta: RequestMeta): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: authContext.sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'LOGOUT' },
    });
    await this.auditService.log({
      eventType: 'LOGOUT',
      actorUserId: authContext.userId,
      actorEmail: authContext.email,
      description: 'User logged out',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        lastLoginAt: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            employeeCode: true,
            designation: { select: { title: true } },
          },
        },
        userRoles: { select: { role: { select: { key: true, label: true } } } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const { userRoles, ...rest } = user;
    return { ...rest, roles: userRoles.map((userRole) => userRole.role) };
  }

  async changePassword(
    authContext: AuthContext,
    dto: ChangePasswordDto,
    meta: RequestMeta,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: authContext.userId },
    });

    const currentValid = await this.passwordService.verify(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!currentValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newHash = await this.passwordService.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, passwordUpdatedAt: new Date() },
    });

    // A changed password invalidates every other session — the credential
    // that authorized them may have leaked. The session making this request
    // is left alone so the user isn't logged out of the tab they're using.
    await this.prisma.session.updateMany({
      where: {
        userId: user.id,
        id: { not: authContext.sessionId },
        revokedAt: null,
      },
      data: { revokedAt: new Date(), revokedReason: 'PASSWORD_CHANGED' },
    });

    await this.auditService.log({
      eventType: 'PASSWORD_CHANGED',
      actorUserId: user.id,
      actorEmail: user.email,
      description: 'Password changed by user',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  private async issueTokens(
    userId: string,
    deviceId: string | undefined,
    ipAddress: string | undefined,
  ) {
    const refreshToken = randomBytes(48).toString('base64url');
    const session = await this.prisma.session.create({
      data: {
        userId,
        deviceId,
        refreshTokenHash: this.hashToken(refreshToken),
        ipAddress,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });
    const accessToken = await this.jwtService.signAsync({
      sub: userId,
      jti: session.id,
    });
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer' as const,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    };
  }

  private hashToken(token: string): string {
    // sha256 (not scrypt): the refresh token is a 48-byte random value, not
    // a user-chosen password — it already has enough entropy that a slow
    // hash buys nothing but latency. Only the hash is ever persisted.
    return createHash('sha256').update(token).digest('hex');
  }
}
