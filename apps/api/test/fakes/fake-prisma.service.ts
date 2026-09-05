/**
 * A hand-rolled in-memory stand-in for PrismaService, used by every
 * `*.e2e-spec.ts` in this repo. No live database in this environment — this
 * lets tests boot the real `AppModule` over HTTP (real guards, pipes,
 * filters) without one. It implements only the query shapes the code
 * actually calls; extend it as new modules add calls, don't generalize
 * ahead of need.
 */

export interface FakeRole {
  id: string;
  key: string;
  label: string;
  /** Permission keys granted to this role — flattened here instead of modeling RolePermission rows. */
  permissionKeys: string[];
}

export interface FakeUser {
  id: string;
  email: string;
  passwordHash: string;
  failedLoginCount: number;
  lockedUntil: Date | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  employee: null;
}

export interface FakeSession {
  id: string;
  userId: string;
  deviceId: string | null;
  refreshTokenHash: string;
  ipAddress?: string;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason?: string | null;
}

interface FakeUserRole {
  userId: string;
  roleId: string;
  assignedByUserId?: string;
}

export class FakePrismaService {
  users = new Map<string, FakeUser>();
  sessions = new Map<string, FakeSession>();
  roles = new Map<string, FakeRole>();
  userRoleRows: FakeUserRole[] = [];

  private rolesForUser(userId: string): FakeRole[] {
    return this.userRoleRows
      .filter((row) => row.userId === userId)
      .map((row) => this.roles.get(row.roleId))
      .filter((role): role is FakeRole => Boolean(role));
  }

  private userRolesJoin(userId: string) {
    return this.rolesForUser(userId).map((role) => ({
      role: {
        key: role.key,
        label: role.label,
        rolePermissions: role.permissionKeys.map((key) => ({
          permission: { key },
        })),
      },
    }));
  }

  // Real Prisma's `select` would strip fields not asked for; this fake
  // always attaches `userRoles` so every call site that selects it (Auth's
  // /me, Users' list/detail/status/roles endpoints) gets the shape it
  // expects, regardless of which `select`/`include` was actually passed.
  private withRoles(user: FakeUser) {
    return { ...user, userRoles: this.userRolesJoin(user.id) };
  }

  user = {
    findUnique: async ({
      where,
    }: {
      where: { id?: string; email?: string };
    }) => {
      let user: FakeUser | undefined;
      if (where.id) user = this.users.get(where.id);
      if (where.email) {
        for (const candidate of this.users.values())
          if (candidate.email === where.email) user = candidate;
      }
      return user ? this.withRoles(user) : null;
    },
    findMany: async () =>
      [...this.users.values()].map((user) => this.withRoles(user)),
    create: async ({
      data,
    }: {
      data: { email: string; passwordHash: string };
    }) => {
      const id = `user-${this.users.size + 1}`;
      const user: FakeUser = {
        id,
        email: data.email,
        passwordHash: data.passwordHash,
        failedLoginCount: 0,
        lockedUntil: null,
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
        employee: null,
      };
      this.users.set(id, user);
      return user;
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

  role = {
    findMany: async ({
      where,
    }: { where?: { key?: { in?: string[] } } } = {}) => {
      const keys = where?.key?.in;
      return [...this.roles.values()].filter(
        (role) => !keys || keys.includes(role.key),
      );
    },
  };

  userRole = {
    createMany: async ({ data }: { data: FakeUserRole[] }) => {
      this.userRoleRows.push(...data);
      return { count: data.length };
    },
    deleteMany: async ({ where }: { where: { userId: string } }) => {
      const before = this.userRoleRows.length;
      this.userRoleRows = this.userRoleRows.filter(
        (row) => row.userId !== where.userId,
      );
      return { count: before - this.userRoleRows.length };
    },
  };

  // Present so AuditService.log() (called on nearly every mutation) has
  // something to write to instead of logging a swallowed failure.
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
          userRoles: this.userRolesJoin(user.id),
        },
      };
    },
  };

  addRole(role: FakeRole): void {
    this.roles.set(role.id, role);
  }

  assignRole(userId: string, roleId: string): void {
    this.userRoleRows.push({ userId, roleId });
  }
}
