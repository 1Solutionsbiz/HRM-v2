import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { AuthContext } from '../auth-context.js';

interface AccessTokenPayload {
  sub: string;
  jti: string;
}

/**
 * Deliberately does NOT trust roles/permissions carried in the JWT — it
 * verifies the signature, then re-reads the backing `Session` row (and the
 * user's current roles/permissions) on every request. This is the one point
 * where revocation (logout, lockout, a role change) actually takes effect;
 * embedding authorization claims in the token would make
 * `Session.revokedAt` decorative for the life of the access token. One
 * indexed PK lookup per request is an acceptable cost for an internal HR
 * app; if that ever needs to change, cache by userId and invalidate on
 * `UserRole`/`RolePermission` writes rather than trusting the token.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.jti },
      select: {
        id: true,
        userId: true,
        revokedAt: true,
        expiresAt: true,
        user: {
          select: {
            email: true,
            isActive: true,
            userRoles: {
              select: {
                role: {
                  select: {
                    key: true,
                    rolePermissions: {
                      select: { permission: { select: { key: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException('Session is no longer valid');
    }
    if (session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session is no longer valid');
    }
    if (!session.user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    const roles = session.user.userRoles.map((userRole) => userRole.role.key);
    const permissions = new Set<string>();
    for (const userRole of session.user.userRoles) {
      for (const rolePermission of userRole.role.rolePermissions) {
        permissions.add(rolePermission.permission.key);
      }
    }

    const authContext: AuthContext = {
      userId: session.userId,
      sessionId: session.id,
      email: session.user.email,
      roles,
      permissions: [...permissions],
    };
    request.authContext = authContext;

    // Best-effort activity tracking — must never fail or delay the request.
    void this.prisma.session
      .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return undefined;
    return header.slice('Bearer '.length).trim() || undefined;
  }
}
