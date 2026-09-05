import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordService } from '../security/password.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext } from '../common/auth-context.js';
import type { CreateUserDto } from './dto/create-user.dto.js';

const DEFAULT_ROLE_KEY = 'employee';

function generateTemporaryPassword(): string {
  return randomBytes(18).toString('base64url');
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateUserDto, actor: AuthContext) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const roleKeys =
      dto.roleKeys && dto.roleKeys.length > 0
        ? dto.roleKeys
        : [DEFAULT_ROLE_KEY];
    const roles = await this.resolveRoles(roleKeys);

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await this.passwordService.hash(temporaryPassword);

    // Not wrapped in a transaction: a crash between these two writes leaves
    // a user with no role, which PUT /users/:id/roles can repair. Accepted
    // for a first pass rather than introducing $transaction untested here.
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash },
    });
    await this.prisma.userRole.createMany({
      data: roles.map((role) => ({
        userId: user.id,
        roleId: role.id,
        assignedByUserId: actor.userId,
      })),
    });

    await this.auditService.log({
      eventType: 'USER_CREATED',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'User',
      targetId: user.id,
      description: `Created user ${user.email} with roles: ${roleKeys.join(', ')}`,
    });

    return {
      id: user.id,
      email: user.email,
      roles: roleKeys,
      // Shown once — never persisted or logged in plaintext (rule 11). The
      // admin must relay it out of band; there's no email delivery yet.
      temporaryPassword,
    };
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        userRoles: { select: { role: { select: { key: true, label: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return users.map(this.serialize);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        userRoles: { select: { role: { select: { key: true, label: true } } } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.serialize(user);
  }

  async setActiveStatus(id: string, isActive: boolean, actor: AuthContext) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({ where: { id }, data: { isActive } });

    if (!isActive) {
      // Deactivation must take effect immediately, not just at next token
      // expiry — JwtAuthGuard checks session.user.isActive too, but a
      // revoked session row is the same defense-in-depth this system
      // applies to logout and password changes.
      await this.prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'ACCOUNT_DEACTIVATED' },
      });
    }

    await this.auditService.log({
      eventType: 'USER_STATUS_CHANGED',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'User',
      targetId: id,
      description: `User ${user.email} set to ${isActive ? 'active' : 'inactive'}`,
    });

    return this.findOne(id);
  }

  async replaceRoles(id: string, roleKeys: string[], actor: AuthContext) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const roles = await this.resolveRoles(roleKeys);

    await this.prisma.userRole.deleteMany({ where: { userId: id } });
    if (roles.length > 0) {
      await this.prisma.userRole.createMany({
        data: roles.map((role) => ({
          userId: id,
          roleId: role.id,
          assignedByUserId: actor.userId,
        })),
      });
    }

    await this.auditService.log({
      eventType: 'ROLE_CHANGED',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'User',
      targetId: id,
      description: `Roles for ${user.email} set to: ${roleKeys.join(', ') || '(none)'}`,
      metadata: { roleKeys },
    });

    return this.findOne(id);
  }

  private async resolveRoles(roleKeys: string[]) {
    if (roleKeys.length === 0) return [];
    const roles = await this.prisma.role.findMany({
      where: { key: { in: roleKeys } },
    });
    const foundKeys = new Set(roles.map((role) => role.key));
    const missing = roleKeys.filter((key) => !foundKeys.has(key));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Unknown role key(s): ${missing.join(', ')}`,
      );
    }
    return roles;
  }

  private serialize(user: {
    id: string;
    email: string;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    userRoles: { role: { key: string; label: string } }[];
  }) {
    const { userRoles, ...rest } = user;
    return { ...rest, roles: userRoles.map((userRole) => userRole.role) };
  }
}
