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

export interface FakeEmployee {
  id: string;
  userId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  personalEmail?: string;
  phone?: string;
  dateOfBirth?: Date | null;
  dateOfJoining: Date;
  employmentType: string;
  workLocation?: string;
  currentAddress?: string;
  status: string;
  avatarUrl: string | null;
  departmentId: string | null;
  designationId: string | null;
  managerId: string | null;
  createdAt: Date;
}

interface FakeBankDetail {
  employeeId: string;
  bankName: string;
  accountNumberEncrypted: string;
  ifscCode: string;
  panNumberEncrypted: string | null;
}

interface FakeEmergencyContact {
  employeeId: string;
  name: string;
  relationship: string;
  phone: string;
}

interface FakeLeaveRequest {
  id: string;
  code: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: Date;
  endDate: Date;
  dayType: string;
  halfDayPeriod: string | null;
  totalDays: { toNumber(): number };
  reason: string;
  status: string;
  approverUserId: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  submittedAt: Date;
}

interface FakeExpenseClaim {
  id: string;
  code: string;
  employeeId: string;
  categoryId: string;
  amount: { toNumber(): number };
  currency: string;
  expenseDate: Date;
  description: string;
  receiptUrl: string | null;
  status: string;
  approverUserId: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  submittedAt: Date;
}

interface FakeSalaryStructure {
  id: string;
  employeeId: string;
  currentAmount: { toNumber(): number };
  status: string;
  lastRevisedAt: Date | null;
  updatedAt: Date;
}

interface FakeSalaryRevision {
  id: string;
  employeeId: string;
  previousAmount: { toNumber(): number } | null;
  newAmount: { toNumber(): number };
  effectiveDate: Date;
  revisedByUserId: string;
  reason: string | null;
  createdAt: Date;
}

interface FakePayslip {
  id: string;
  payslipNumber: string;
  employeeId: string;
  periodMonth: number;
  periodYear: number;
  grossAmount: { toNumber(): number };
  netAmount: { toNumber(): number };
  status: string;
  paidAt: Date | null;
  generatedByUserId: string | null;
  generatedAt: Date;
}

interface FakePayslipLineItem {
  id: string;
  payslipId: string;
  type: string;
  label: string;
  amount: { toNumber(): number };
  sortOrder: number;
}

export class FakePrismaService {
  // No real atomicity — the fake is single-threaded and in-memory, so a
  // transaction is just "run the callback against this same instance." Good
  // enough to exercise the calling code's shape; it can't catch a real
  // partial-write race, only a wrong sequence of calls.
  async $transaction<T>(fn: (tx: this) => Promise<T>): Promise<T> {
    return fn(this);
  }

  users = new Map<string, FakeUser>();
  sessions = new Map<string, FakeSession>();
  roles = new Map<string, FakeRole>();
  userRoleRows: FakeUserRole[] = [];
  employees = new Map<string, FakeEmployee>();
  bankDetails = new Map<string, FakeBankDetail>();
  emergencyContacts = new Map<string, FakeEmergencyContact>();
  sequenceCounters = new Map<string, number>();
  departments = new Map<
    string,
    { id: string; name: string; code: string | null }
  >();
  designations = new Map<
    string,
    { id: string; title: string; departmentId: string }
  >();

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
      return [...this.roles.values()]
        .filter((role) => !keys || keys.includes(role.key))
        .map((role) => ({
          ...role,
          // Real Prisma would carry the seeded Permission.description here;
          // the fake has no separate Permission entity (roles just flatten
          // permissionKeys), so it stands in the key itself. Fine for e2e,
          // which only needs the join to exist, not exact copy.
          rolePermissions: role.permissionKeys.map((key) => ({
            permission: { key, description: key },
          })),
        }));
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

  department = {
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.departments.get(where.id) ?? null,
    findMany: async () => [...this.departments.values()],
    create: async ({ data }: { data: { name: string; code?: string } }) => {
      const id = `department-${this.departments.size + 1}`;
      const department = { id, name: data.name, code: data.code ?? null };
      this.departments.set(id, department);
      return department;
    },
  };

  designation = {
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.designations.get(where.id) ?? null,
    findMany: async () => [...this.designations.values()],
    create: async ({
      data,
    }: {
      data: { title: string; departmentId: string };
    }) => {
      const id = `designation-${this.designations.size + 1}`;
      const designation = { id, ...data };
      this.designations.set(id, designation);
      return designation;
    },
  };

  sequenceCounter = {
    update: async ({
      where,
      data,
    }: {
      where: { key: string };
      data: { value: { increment: number } };
    }) => {
      const current = this.sequenceCounters.get(where.key);
      if (current === undefined) {
        throw new Error(
          `no fake sequence counter "${where.key}" — call seedSequenceCounter() first`,
        );
      }
      const value = current + data.value.increment;
      this.sequenceCounters.set(where.key, value);
      return { key: where.key, value };
    },
  };

  onboardingStepTemplate = {
    findMany: async () =>
      [] as {
        id: string;
        name: string;
        sortOrder: number;
        isActive: boolean;
      }[],
  };

  employeeOnboardingStep = {
    createMany: async () => ({ count: 0 }),
    findMany: async () => [] as unknown[],
    findUnique: async () => null,
    update: async () => {
      throw new Error('no fake onboarding steps seeded');
    },
  };

  private employeeWithRelations(employee: FakeEmployee) {
    return {
      ...employee,
      department: employee.departmentId
        ? (this.departments.get(employee.departmentId) ?? null)
        : null,
      designation: employee.designationId
        ? (this.designations.get(employee.designationId) ?? null)
        : null,
      user: employee.userId
        ? {
            email: this.users.get(employee.userId)?.email,
            userRoles: this.userRolesJoin(employee.userId),
          }
        : undefined,
      manager: employee.managerId
        ? (() => {
            const manager = this.employees.get(employee.managerId!);
            return manager
              ? {
                  id: manager.id,
                  firstName: manager.firstName,
                  lastName: manager.lastName,
                }
              : null;
          })()
        : null,
      emergencyContact: this.emergencyContacts.get(employee.id) ?? null,
      bankDetail: this.bankDetails.get(employee.id) ?? null,
    };
  }

  employee = {
    create: async ({
      data,
    }: {
      data: Omit<FakeEmployee, 'id' | 'createdAt' | 'status' | 'avatarUrl'>;
    }) => {
      const id = `employee-${this.employees.size + 1}`;
      const employee: FakeEmployee = {
        id,
        status: 'ACTIVE',
        avatarUrl: null,
        createdAt: new Date(),
        ...data,
      };
      this.employees.set(id, employee);
      return employee;
    },
    findMany: async () =>
      [...this.employees.values()].map((employee) =>
        this.employeeWithRelations(employee),
      ),
    findUnique: async ({
      where,
    }: {
      where: { id?: string; userId?: string };
    }) => {
      let employee: FakeEmployee | undefined;
      if (where.id) employee = this.employees.get(where.id);
      if (where.userId) {
        for (const candidate of this.employees.values())
          if (candidate.userId === where.userId) employee = candidate;
      }
      return employee ? this.employeeWithRelations(employee) : null;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<FakeEmployee>;
    }) => {
      const employee = this.employees.get(where.id);
      if (!employee) throw new Error(`no fake employee ${where.id}`);
      Object.assign(employee, data);
      return employee;
    },
  };

  employeeBankDetail = {
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { employeeId: string };
      create: FakeBankDetail;
      update: Omit<FakeBankDetail, 'employeeId'>;
    }) => {
      const existing = this.bankDetails.get(where.employeeId);
      const record = existing ? { ...existing, ...update } : create;
      this.bankDetails.set(where.employeeId, record);
      return record;
    },
  };

  employeeEmergencyContact = {
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { employeeId: string };
      create: FakeEmergencyContact;
      update: Omit<FakeEmergencyContact, 'employeeId'>;
    }) => {
      const existing = this.emergencyContacts.get(where.employeeId);
      const record = existing ? { ...existing, ...update } : create;
      this.emergencyContacts.set(where.employeeId, record);
      return record;
    },
  };

  addRole(role: FakeRole): void {
    this.roles.set(role.id, role);
  }

  assignRole(userId: string, roleId: string): void {
    this.userRoleRows.push({ userId, roleId });
  }

  seedSequenceCounter(key: string, value = 0): void {
    this.sequenceCounters.set(key, value);
  }

  notifications = new Map<
    string,
    {
      id: string;
      userId: string;
      type: string;
      title: string;
      description: string;
      linkUrl?: string;
      isRead: boolean;
      createdAt: Date;
    }
  >();

  notification = {
    create: async ({
      data,
    }: {
      data: {
        userId: string;
        type: string;
        title: string;
        description: string;
        linkUrl?: string;
      };
    }) => {
      const id = `notification-${this.notifications.size + 1}`;
      const notification = {
        id,
        isRead: false,
        createdAt: new Date(),
        ...data,
      };
      this.notifications.set(id, notification);
      return notification;
    },
    findMany: async ({ where }: { where: { userId: string } }) =>
      [...this.notifications.values()].filter((n) => n.userId === where.userId),
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.notifications.get(where.id) ?? null,
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: { isRead: boolean };
    }) => {
      const notification = this.notifications.get(where.id);
      if (!notification) throw new Error(`no fake notification ${where.id}`);
      Object.assign(notification, data);
      return notification;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: { userId: string; isRead: boolean };
      data: { isRead: boolean };
    }) => {
      let count = 0;
      for (const notification of this.notifications.values()) {
        if (
          notification.userId !== where.userId ||
          notification.isRead !== where.isRead
        )
          continue;
        Object.assign(notification, data);
        count++;
      }
      return { count };
    },
  };

  attendanceDays = new Map<
    string,
    {
      id: string;
      employeeId: string;
      date: Date;
      status: string;
      firstCheckInAt: Date | null;
      lastCheckOutAt: Date | null;
      workedMinutes: number | null;
      lateMinutes: number;
      leaveRequestId: string | null;
    }
  >();
  attendanceEvents = new Map<
    string,
    {
      id: string;
      attendanceDayId: string;
      employeeId: string;
      type: string;
      occurredAt: Date;
    }
  >();
  holidays: { date: Date; isActive: boolean }[] = [];
  attendancePolicy_: {
    id: string;
    standardStartTime: Date;
    standardEndTime: Date;
    graceMinutes: number;
    halfDayThresholdHours: { toNumber: () => number };
    fullDayHours: { toNumber: () => number };
    workingWeekdays: number[];
  } | null = null;
  companySettings_: {
    id: string;
    legalName: string;
    brandName: string;
    website: string | null;
    supportEmail: string;
    phone: string | null;
    address: string | null;
    timezone: string;
    updatedAt: Date;
    updatedByUserId: string | null;
  } | null = null;

  companySettings = {
    findUnique: async () => this.companySettings_,
    update: async ({
      data,
    }: {
      data: {
        legalName: string;
        brandName: string;
        website: string | null;
        supportEmail: string;
        phone: string | null;
        address: string | null;
        updatedByUserId: string;
      };
    }) => {
      if (!this.companySettings_)
        throw new Error(
          'no fake company settings — call seedCompanySettings() first',
        );
      this.companySettings_ = {
        ...this.companySettings_,
        ...data,
        updatedAt: new Date(),
      };
      return this.companySettings_;
    },
  };

  seedCompanySettings(
    overrides: Partial<NonNullable<FakePrismaService['companySettings_']>> = {},
  ): void {
    this.companySettings_ = {
      id: 'singleton',
      legalName: '1Solutions Pvt. Ltd.',
      brandName: '1Solutions',
      website: 'https://1solutions.biz',
      supportEmail: 'hr@1solutions.biz',
      phone: '+91 11 4567 8900',
      address: 'F Block, Laxmi Nagar, New Delhi, Delhi 110092',
      timezone: 'Asia/Kolkata',
      updatedAt: new Date(),
      updatedByUserId: null,
      ...overrides,
    };
  }

  private dateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  attendanceDay = {
    findUnique: async ({
      where,
    }: {
      where: {
        id?: string;
        employeeId_date?: { employeeId: string; date: Date };
      };
    }) => {
      if (where.id) return this.attendanceDays.get(where.id) ?? null;
      if (where.employeeId_date) {
        const { employeeId, date } = where.employeeId_date;
        for (const day of this.attendanceDays.values()) {
          if (
            day.employeeId === employeeId &&
            this.dateKey(day.date) === this.dateKey(date)
          )
            return day;
        }
      }
      return null;
    },
    findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
      const day = this.attendanceDays.get(where.id);
      if (!day) throw new Error(`no fake attendance day ${where.id}`);
      return day;
    },
    findMany: async ({
      where,
    }: {
      where: { employeeId: string; date: { gte: Date; lte: Date } };
    }) =>
      [...this.attendanceDays.values()].filter(
        (day) =>
          day.employeeId === where.employeeId &&
          day.date >= where.date.gte &&
          day.date <= where.date.lte,
      ),
    create: async ({ data }: { data: { employeeId: string; date: Date } }) => {
      const id = `attendance-day-${this.attendanceDays.size + 1}`;
      const day = {
        id,
        status: 'PRESENT',
        firstCheckInAt: null,
        lastCheckOutAt: null,
        workedMinutes: null,
        lateMinutes: 0,
        leaveRequestId: null,
        ...data,
      };
      this.attendanceDays.set(id, day);
      return day;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const day = this.attendanceDays.get(where.id);
      if (!day) throw new Error(`no fake attendance day ${where.id}`);
      Object.assign(day, data);
      return day;
    },
  };

  attendanceEvent = {
    findFirst: async ({
      where,
    }: {
      where: { attendanceDayId: string; type: string };
    }) =>
      [...this.attendanceEvents.values()].find(
        (event) =>
          event.attendanceDayId === where.attendanceDayId &&
          event.type === where.type,
      ) ?? null,
    findMany: async ({ where }: { where: { attendanceDayId: string } }) =>
      [...this.attendanceEvents.values()]
        .filter((event) => event.attendanceDayId === where.attendanceDayId)
        .sort((a, b) => a.id.localeCompare(b.id)),
    create: async ({
      data,
    }: {
      data: {
        attendanceDayId: string;
        employeeId: string;
        type: string;
        occurredAt: Date;
      };
    }) => {
      const id = `attendance-event-${String(this.attendanceEvents.size + 1).padStart(4, '0')}`;
      const event = { id, ...data };
      this.attendanceEvents.set(id, event);
      return event;
    },
  };

  holiday = {
    findMany: async ({
      where,
    }: {
      where: { isActive: boolean; date: { gte: Date; lte: Date } };
    }) =>
      this.holidays.filter(
        (holiday) =>
          holiday.isActive === where.isActive &&
          holiday.date >= where.date.gte &&
          holiday.date <= where.date.lte,
      ),
  };

  attendancePolicy = {
    findUnique: async () => this.attendancePolicy_,
  };

  seedAttendancePolicy(
    overrides: Partial<
      NonNullable<FakePrismaService['attendancePolicy_']>
    > = {},
  ): void {
    this.attendancePolicy_ = {
      id: 'singleton',
      standardStartTime: new Date(Date.UTC(1970, 0, 1, 9, 30, 0)),
      standardEndTime: new Date(Date.UTC(1970, 0, 1, 18, 30, 0)),
      graceMinutes: 15,
      halfDayThresholdHours: { toNumber: () => 4.5 },
      fullDayHours: { toNumber: () => 9 },
      workingWeekdays: [1, 2, 3, 4, 5],
      ...overrides,
    };
  }

  // --- Leave -----------------------------------------------------------

  leaveTypes = new Map<
    string,
    {
      id: string;
      key: string;
      name: string;
      defaultAnnualDays: { toNumber(): number };
      isActive: boolean;
    }
  >();
  leaveBalances = new Map<
    string,
    {
      employeeId: string;
      leaveTypeId: string;
      year: number;
      allocatedDays: { toNumber(): number };
      usedDays: { toNumber(): number };
      carriedOverDays: { toNumber(): number };
    }
  >();
  leaveRequests = new Map<string, FakeLeaveRequest>();

  private static decimalShim(value: number | { toNumber(): number }): {
    toNumber(): number;
  } {
    return typeof value === 'number' ? { toNumber: () => value } : value;
  }

  private leaveBalanceKey(
    employeeId: string,
    leaveTypeId: string,
    year: number,
  ): string {
    return `${employeeId}:${leaveTypeId}:${year}`;
  }

  leaveType = {
    findMany: async ({ where }: { where?: { isActive?: boolean } } = {}) =>
      [...this.leaveTypes.values()].filter(
        (leaveType) =>
          where?.isActive === undefined ||
          leaveType.isActive === where.isActive,
      ),
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.leaveTypes.get(where.id) ?? null,
    findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
      const leaveType = this.leaveTypes.get(where.id);
      if (!leaveType) throw new Error(`no fake leave type ${where.id}`);
      return leaveType;
    },
  };

  leaveBalance = {
    findMany: async ({
      where,
    }: {
      where: { employeeId: string; year: number };
    }) =>
      [...this.leaveBalances.values()].filter(
        (balance) =>
          balance.employeeId === where.employeeId &&
          balance.year === where.year,
      ),
    findUnique: async ({
      where,
    }: {
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: string;
          leaveTypeId: string;
          year: number;
        };
      };
    }) => {
      const { employeeId, leaveTypeId, year } =
        where.employeeId_leaveTypeId_year;
      return (
        this.leaveBalances.get(
          this.leaveBalanceKey(employeeId, leaveTypeId, year),
        ) ?? null
      );
    },
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: string;
          leaveTypeId: string;
          year: number;
        };
      };
      create: {
        allocatedDays: number | { toNumber(): number };
        usedDays: number | { toNumber(): number };
      };
      update: { usedDays?: { increment: number | { toNumber(): number } } };
    }) => {
      const { employeeId, leaveTypeId, year } =
        where.employeeId_leaveTypeId_year;
      const key = this.leaveBalanceKey(employeeId, leaveTypeId, year);
      const existing = this.leaveBalances.get(key);
      if (existing) {
        if (update.usedDays?.increment !== undefined) {
          const increment =
            typeof update.usedDays.increment === 'number'
              ? update.usedDays.increment
              : update.usedDays.increment.toNumber();
          existing.usedDays = FakePrismaService.decimalShim(
            existing.usedDays.toNumber() + increment,
          );
        }
        return existing;
      }
      const record = {
        employeeId,
        leaveTypeId,
        year,
        allocatedDays: FakePrismaService.decimalShim(create.allocatedDays),
        usedDays: FakePrismaService.decimalShim(create.usedDays),
        carriedOverDays: FakePrismaService.decimalShim(0),
      };
      this.leaveBalances.set(key, record);
      return record;
    },
  };

  // Real Prisma's `include`/`select` would attach these joins on demand;
  // this fake always attaches them so findMany's callers (LeaveService's
  // getMyRequests/getCompanyRequests, both of which do `include`) get the
  // shape they expect regardless of the exact include clause passed.
  private leaveRequestWithRelations(request: FakeLeaveRequest) {
    const leaveType = this.leaveTypes.get(request.leaveTypeId);
    const employee = this.employees.get(request.employeeId);
    return {
      ...request,
      leaveType: leaveType
        ? { key: leaveType.key, name: leaveType.name }
        : undefined,
      employee: employee
        ? {
            id: employee.id,
            firstName: employee.firstName,
            lastName: employee.lastName,
          }
        : undefined,
    };
  }

  leaveRequest = {
    findMany: async ({
      where,
    }: {
      where?: {
        employeeId?: string;
        leaveTypeId?: string;
        status?: { in: string[] };
      };
    } = {}) =>
      [...this.leaveRequests.values()]
        .filter((request) => {
          if (where?.employeeId && request.employeeId !== where.employeeId)
            return false;
          if (where?.leaveTypeId && request.leaveTypeId !== where.leaveTypeId)
            return false;
          if (where?.status?.in && !where.status.in.includes(request.status))
            return false;
          return true;
        })
        .map((request) => this.leaveRequestWithRelations(request)),
    findFirst: async ({
      where,
    }: {
      where: {
        employeeId: string;
        status: { in: string[] };
        startDate: { lte: Date };
        endDate: { gte: Date };
      };
    }) => {
      for (const request of this.leaveRequests.values()) {
        if (request.employeeId !== where.employeeId) continue;
        if (!where.status.in.includes(request.status)) continue;
        if (!(request.startDate <= where.startDate.lte)) continue;
        if (!(request.endDate >= where.endDate.gte)) continue;
        return request;
      }
      return null;
    },
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.leaveRequests.get(where.id) ?? null,
    create: async ({
      data,
    }: {
      data: {
        code: string;
        employeeId: string;
        leaveTypeId: string;
        startDate: Date;
        endDate: Date;
        dayType: string;
        halfDayPeriod?: string;
        totalDays: number;
        reason: string;
      };
    }) => {
      const id = `leave-request-${this.leaveRequests.size + 1}`;
      const record = {
        id,
        ...data,
        halfDayPeriod: data.halfDayPeriod ?? null,
        totalDays: FakePrismaService.decimalShim(data.totalDays),
        status: 'PENDING',
        approverUserId: null,
        decidedAt: null,
        decisionNote: null,
        submittedAt: new Date(),
      };
      this.leaveRequests.set(id, record);
      return record;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const request = this.leaveRequests.get(where.id);
      if (!request) throw new Error(`no fake leave request ${where.id}`);
      Object.assign(request, data);
      return request;
    },
  };

  seedLeaveType(input: {
    id: string;
    key: string;
    name: string;
    defaultAnnualDays: number;
    isActive?: boolean;
  }): void {
    this.leaveTypes.set(input.id, {
      ...input,
      defaultAnnualDays: FakePrismaService.decimalShim(input.defaultAnnualDays),
      isActive: input.isActive ?? true,
    });
  }

  // --- Documents ---------------------------------------------------------

  documentTypes = new Map<
    string,
    { id: string; key: string; name: string; category: string }
  >();
  employeeDocuments = new Map<
    string,
    {
      employeeId: string;
      documentTypeId: string;
      fileUrl: string | null;
      status: string;
      uploadedAt: Date | null;
      verifiedByUserId: string | null;
      verifiedAt: Date | null;
      notes: string | null;
    }
  >();

  private employeeDocumentKey(
    employeeId: string,
    documentTypeId: string,
  ): string {
    return `${employeeId}:${documentTypeId}`;
  }

  documentType = {
    findMany: async () => [...this.documentTypes.values()],
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.documentTypes.get(where.id) ?? null,
  };

  employeeDocument = {
    findMany: async ({ where }: { where: { employeeId: string } }) =>
      [...this.employeeDocuments.values()].filter(
        (doc) => doc.employeeId === where.employeeId,
      ),
    findUnique: async ({
      where,
    }: {
      where: {
        employeeId_documentTypeId: {
          employeeId: string;
          documentTypeId: string;
        };
      };
    }) => {
      const { employeeId, documentTypeId } = where.employeeId_documentTypeId;
      return (
        this.employeeDocuments.get(
          this.employeeDocumentKey(employeeId, documentTypeId),
        ) ?? null
      );
    },
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: {
        employeeId_documentTypeId: {
          employeeId: string;
          documentTypeId: string;
        };
      };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => {
      const { employeeId, documentTypeId } = where.employeeId_documentTypeId;
      const key = this.employeeDocumentKey(employeeId, documentTypeId);
      const existing = this.employeeDocuments.get(key);
      const record = existing
        ? { ...existing, ...update }
        : { employeeId, documentTypeId, ...create };
      this.employeeDocuments.set(key, record as never);
      return record;
    },
    update: async ({
      where,
      data,
    }: {
      where: {
        employeeId_documentTypeId: {
          employeeId: string;
          documentTypeId: string;
        };
      };
      data: Record<string, unknown>;
    }) => {
      const { employeeId, documentTypeId } = where.employeeId_documentTypeId;
      const key = this.employeeDocumentKey(employeeId, documentTypeId);
      const existing = this.employeeDocuments.get(key);
      if (!existing) throw new Error(`no fake employee document ${key}`);
      Object.assign(existing, data);
      return existing;
    },
  };

  seedDocumentType(input: {
    id: string;
    key: string;
    name: string;
    category: string;
  }): void {
    this.documentTypes.set(input.id, input);
  }

  // --- Expenses ------------------------------------------------------

  expenseCategories = new Map<
    string,
    {
      id: string;
      name: string;
      monthlyCapAmount: { toNumber(): number } | null;
      isActive: boolean;
    }
  >();
  expenseClaims = new Map<string, FakeExpenseClaim>();

  private expenseClaimWithRelations(claim: FakeExpenseClaim) {
    const category = this.expenseCategories.get(claim.categoryId);
    const employee = this.employees.get(claim.employeeId);
    return {
      ...claim,
      category: category ? { name: category.name } : undefined,
      employee: employee
        ? {
            id: employee.id,
            firstName: employee.firstName,
            lastName: employee.lastName,
          }
        : undefined,
    };
  }

  expenseCategory = {
    findMany: async ({ where }: { where?: { isActive?: boolean } } = {}) =>
      [...this.expenseCategories.values()].filter(
        (category) =>
          where?.isActive === undefined || category.isActive === where.isActive,
      ),
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.expenseCategories.get(where.id) ?? null,
  };

  expenseClaim = {
    findMany: async ({
      where,
    }: {
      where?: {
        employeeId?: string;
        categoryId?: string;
        status?: { in: string[] };
        expenseDate?: { gte: Date; lte: Date };
      };
    } = {}) =>
      [...this.expenseClaims.values()]
        .filter((claim) => {
          if (where?.employeeId && claim.employeeId !== where.employeeId)
            return false;
          if (where?.categoryId && claim.categoryId !== where.categoryId)
            return false;
          if (where?.status?.in && !where.status.in.includes(claim.status))
            return false;
          if (
            where?.expenseDate &&
            !(
              claim.expenseDate >= where.expenseDate.gte &&
              claim.expenseDate <= where.expenseDate.lte
            )
          )
            return false;
          return true;
        })
        .map((claim) => this.expenseClaimWithRelations(claim)),
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.expenseClaims.get(where.id) ?? null,
    create: async ({
      data,
    }: {
      data: {
        code: string;
        employeeId: string;
        categoryId: string;
        amount: number;
        expenseDate: Date;
        description: string;
        receiptUrl?: string;
      };
    }) => {
      const id = `expense-claim-${this.expenseClaims.size + 1}`;
      const record: FakeExpenseClaim = {
        id,
        ...data,
        amount: FakePrismaService.decimalShim(data.amount),
        currency: 'INR',
        receiptUrl: data.receiptUrl ?? null,
        status: 'PENDING',
        approverUserId: null,
        decidedAt: null,
        decisionNote: null,
        submittedAt: new Date(),
      };
      this.expenseClaims.set(id, record);
      return record;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const claim = this.expenseClaims.get(where.id);
      if (!claim) throw new Error(`no fake expense claim ${where.id}`);
      Object.assign(claim, data);
      return claim;
    },
  };

  seedExpenseCategory(input: {
    id: string;
    name: string;
    monthlyCapAmount?: number | null;
    isActive?: boolean;
  }): void {
    this.expenseCategories.set(input.id, {
      id: input.id,
      name: input.name,
      monthlyCapAmount:
        input.monthlyCapAmount != null
          ? FakePrismaService.decimalShim(input.monthlyCapAmount)
          : null,
      isActive: input.isActive ?? true,
    });
  }

  // --- Performance -----------------------------------------------------

  performanceCycles = new Map<
    string,
    {
      id: string;
      name: string;
      startDate: Date;
      endDate: Date;
      isActive: boolean;
    }
  >();
  goals = new Map<
    string,
    {
      id: string;
      employeeId: string;
      cycleId: string;
      title: string;
      progressPercent: number;
      dueDate: Date | null;
    }
  >();
  performanceReviews = new Map<
    string,
    {
      id: string;
      employeeId: string;
      cycleId: string;
      rating: { toNumber(): number };
      maxRating: number;
      summary: string;
      reviewedByUserId: string;
      reviewedAt: Date;
    }
  >();
  recognitions = new Map<
    string,
    {
      id: string;
      employeeId: string;
      title: string;
      source: string;
      awardedAt: Date;
    }
  >();

  performanceCycle = {
    findMany: async () => [...this.performanceCycles.values()],
    findFirst: async ({ where }: { where?: { isActive?: boolean } } = {}) => {
      const matches = [...this.performanceCycles.values()].filter(
        (cycle) =>
          where?.isActive === undefined || cycle.isActive === where.isActive,
      );
      matches.sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
      return matches[0] ?? null;
    },
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.performanceCycles.get(where.id) ?? null,
  };

  goal = {
    findMany: async ({
      where,
    }: {
      where: { employeeId: string; cycleId: string };
    }) =>
      [...this.goals.values()].filter(
        (goal) =>
          goal.employeeId === where.employeeId &&
          goal.cycleId === where.cycleId,
      ),
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.goals.get(where.id) ?? null,
    create: async ({
      data,
    }: {
      data: {
        employeeId: string;
        cycleId: string;
        title: string;
        dueDate?: Date;
      };
    }) => {
      const id = `goal-${this.goals.size + 1}`;
      const goal = {
        id,
        progressPercent: 0,
        dueDate: data.dueDate ?? null,
        ...data,
      };
      this.goals.set(id, goal);
      return goal;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const goal = this.goals.get(where.id);
      if (!goal) throw new Error(`no fake goal ${where.id}`);
      Object.assign(goal, data);
      return goal;
    },
  };

  performanceReview = {
    findFirst: async ({ where }: { where: { employeeId: string } }) => {
      const matches = [...this.performanceReviews.values()].filter(
        (review) => review.employeeId === where.employeeId,
      );
      matches.sort((a, b) => (a.reviewedAt < b.reviewedAt ? 1 : -1));
      const review = matches[0];
      if (!review) return null;
      const reviewerEmployee = [...this.employees.values()].find(
        (employee) => employee.userId === review.reviewedByUserId,
      );
      const cycle = this.performanceCycles.get(review.cycleId);
      return {
        ...review,
        reviewedByUser: {
          employee: reviewerEmployee
            ? {
                firstName: reviewerEmployee.firstName,
                lastName: reviewerEmployee.lastName,
              }
            : null,
        },
        cycle: cycle ? { name: cycle.name } : undefined,
      };
    },
    create: async ({
      data,
    }: {
      data: {
        employeeId: string;
        cycleId: string;
        rating: number;
        maxRating: number;
        summary: string;
        reviewedByUserId: string;
      };
    }) => {
      const id = `review-${this.performanceReviews.size + 1}`;
      const review = {
        id,
        reviewedAt: new Date(),
        ...data,
        rating: FakePrismaService.decimalShim(data.rating),
      };
      this.performanceReviews.set(id, review);
      return review;
    },
  };

  recognition = {
    findMany: async ({ where }: { where: { employeeId: string } }) =>
      [...this.recognitions.values()].filter(
        (recognition) => recognition.employeeId === where.employeeId,
      ),
    create: async ({
      data,
    }: {
      data: { employeeId: string; title: string; source: string };
    }) => {
      const id = `recognition-${this.recognitions.size + 1}`;
      const recognition = { id, awardedAt: new Date(), ...data };
      this.recognitions.set(id, recognition);
      return recognition;
    },
  };

  seedPerformanceCycle(input: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    isActive?: boolean;
  }): void {
    this.performanceCycles.set(input.id, {
      ...input,
      isActive: input.isActive ?? true,
    });
  }

  // --- Announcements -----------------------------------------------------

  announcementRows = new Map<
    string,
    {
      id: string;
      title: string;
      body: string;
      category: string;
      publishedByUserId: string;
      publishedAt: Date;
    }
  >();
  announcementReads = new Map<
    string,
    { id: string; announcementId: string; userId: string; readAt: Date }
  >();

  private announcementReadKey(announcementId: string, userId: string): string {
    return `${announcementId}:${userId}`;
  }

  announcement = {
    findMany: async () =>
      [...this.announcementRows.values()].sort((a, b) =>
        a.publishedAt < b.publishedAt ? 1 : -1,
      ),
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.announcementRows.get(where.id) ?? null,
    create: async ({
      data,
    }: {
      data: {
        title: string;
        body: string;
        category: string;
        publishedByUserId: string;
      };
    }) => {
      const id = `announcement-${this.announcementRows.size + 1}`;
      const announcement = { id, publishedAt: new Date(), ...data };
      this.announcementRows.set(id, announcement);
      return announcement;
    },
  };

  announcementRead = {
    findMany: async ({ where }: { where: { userId: string } }) =>
      [...this.announcementReads.values()].filter(
        (read) => read.userId === where.userId,
      ),
    upsert: async ({
      where,
      create,
    }: {
      where: {
        announcementId_userId: { announcementId: string; userId: string };
      };
      create: { announcementId: string; userId: string };
      update: Record<string, never>;
    }) => {
      const key = this.announcementReadKey(
        where.announcementId_userId.announcementId,
        where.announcementId_userId.userId,
      );
      const existing = this.announcementReads.get(key);
      if (existing) return existing;
      const id = `announcement-read-${this.announcementReads.size + 1}`;
      const read = { id, readAt: new Date(), ...create };
      this.announcementReads.set(key, read);
      return read;
    },
  };

  // --- Resignation -------------------------------------------------------

  resignations = new Map<
    string,
    {
      id: string;
      employeeId: string;
      reason: string;
      submittedAt: Date;
      lastWorkingDay: Date;
      noticePeriodDays: number;
      status: string;
      decidedByUserId: string | null;
      decidedAt: Date | null;
      decisionNote: string | null;
    }
  >();

  private resignationWithRelations(
    resignation: NonNullable<
      ReturnType<FakePrismaService['resignations']['get']>
    >,
  ) {
    const employee = this.employees.get(resignation.employeeId);
    return {
      ...resignation,
      employee: employee
        ? {
            id: employee.id,
            firstName: employee.firstName,
            lastName: employee.lastName,
          }
        : undefined,
    };
  }

  resignation = {
    findMany: async ({ where }: { where?: { employeeId?: string } } = {}) =>
      [...this.resignations.values()]
        .filter(
          (resignation) =>
            !where?.employeeId || resignation.employeeId === where.employeeId,
        )
        .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))
        .map((resignation) => this.resignationWithRelations(resignation)),
    findFirst: async ({
      where,
    }: {
      where: { employeeId: string; status: string };
    }) =>
      [...this.resignations.values()].find(
        (resignation) =>
          resignation.employeeId === where.employeeId &&
          resignation.status === where.status,
      ) ?? null,
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.resignations.get(where.id) ?? null,
    create: async ({
      data,
    }: {
      data: {
        employeeId: string;
        reason: string;
        submittedAt: Date;
        lastWorkingDay: Date;
        noticePeriodDays: number;
      };
    }) => {
      const id = `resignation-${this.resignations.size + 1}`;
      const resignation = {
        id,
        status: 'PENDING',
        decidedByUserId: null,
        decidedAt: null,
        decisionNote: null,
        ...data,
      };
      this.resignations.set(id, resignation);
      return resignation;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const resignation = this.resignations.get(where.id);
      if (!resignation) throw new Error(`no fake resignation ${where.id}`);
      Object.assign(resignation, data);
      return resignation;
    },
  };

  // --- Payroll -------------------------------------------------------

  salaryStructures = new Map<string, FakeSalaryStructure>(); // keyed by employeeId (schema: @unique)
  salaryRevisions = new Map<string, FakeSalaryRevision>();
  payslips = new Map<string, FakePayslip>();
  payslipLineItems = new Map<string, FakePayslipLineItem[]>(); // keyed by payslipId

  private payslipWithLineItems(payslip: FakePayslip) {
    return {
      ...payslip,
      lineItems: this.payslipLineItems.get(payslip.id) ?? [],
    };
  }

  private salaryStructureWithEmployee(structure: FakeSalaryStructure) {
    const employee = this.employees.get(structure.employeeId);
    return {
      ...structure,
      employee: employee
        ? {
            id: employee.id,
            firstName: employee.firstName,
            lastName: employee.lastName,
            departmentId: employee.departmentId,
          }
        : undefined,
    };
  }

  salaryStructure = {
    findUnique: async ({ where }: { where: { employeeId: string } }) =>
      this.salaryStructures.get(where.employeeId) ?? null,
    findMany: async () =>
      [...this.salaryStructures.values()].map((structure) =>
        this.salaryStructureWithEmployee(structure),
      ),
    create: async ({
      data,
    }: {
      data: {
        employeeId: string;
        currentAmount: number;
        lastRevisedAt: Date | null;
      };
    }) => {
      const structure: FakeSalaryStructure = {
        id: `salary-structure-${this.salaryStructures.size + 1}`,
        employeeId: data.employeeId,
        currentAmount: FakePrismaService.decimalShim(data.currentAmount),
        status: 'ACTIVE',
        lastRevisedAt: data.lastRevisedAt,
        updatedAt: new Date(),
      };
      this.salaryStructures.set(data.employeeId, structure);
      return structure;
    },
    update: async ({
      where,
      data,
    }: {
      where: { employeeId: string };
      data: { currentAmount?: number; lastRevisedAt?: Date | null };
    }) => {
      const existing = this.salaryStructures.get(where.employeeId);
      if (!existing)
        throw new Error(`no fake salary structure for ${where.employeeId}`);
      const updated: FakeSalaryStructure = {
        ...existing,
        ...(data.currentAmount !== undefined
          ? { currentAmount: FakePrismaService.decimalShim(data.currentAmount) }
          : {}),
        ...(data.lastRevisedAt !== undefined
          ? { lastRevisedAt: data.lastRevisedAt }
          : {}),
        updatedAt: new Date(),
      };
      this.salaryStructures.set(where.employeeId, updated);
      return updated;
    },
  };

  salaryRevision = {
    findMany: async ({ where }: { where: { employeeId: string } }) =>
      [...this.salaryRevisions.values()]
        .filter((revision) => revision.employeeId === where.employeeId)
        .sort((a, b) => (a.effectiveDate < b.effectiveDate ? 1 : -1)),
    create: async ({
      data,
    }: {
      data: {
        employeeId: string;
        previousAmount: number | null;
        newAmount: number;
        effectiveDate: Date;
        revisedByUserId: string;
        reason: string | null;
      };
    }) => {
      const revision: FakeSalaryRevision = {
        id: `salary-revision-${this.salaryRevisions.size + 1}`,
        employeeId: data.employeeId,
        previousAmount:
          data.previousAmount !== null
            ? FakePrismaService.decimalShim(data.previousAmount)
            : null,
        newAmount: FakePrismaService.decimalShim(data.newAmount),
        effectiveDate: data.effectiveDate,
        revisedByUserId: data.revisedByUserId,
        reason: data.reason,
        createdAt: new Date(),
      };
      this.salaryRevisions.set(revision.id, revision);
      return revision;
    },
  };

  payslip = {
    findUnique: async ({ where }: { where: { id: string } }) => {
      const payslip = this.payslips.get(where.id);
      return payslip ? this.payslipWithLineItems(payslip) : null;
    },
    findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
      const payslip = this.payslips.get(where.id);
      if (!payslip) throw new Error(`no fake payslip ${where.id}`);
      return this.payslipWithLineItems(payslip);
    },
    findFirst: async ({
      where,
      orderBy,
    }: {
      where?: {
        employeeId?: string;
        periodMonth?: number;
        periodYear?: number;
      };
      orderBy?: { periodYear?: string; periodMonth?: string }[];
    } = {}) => {
      let candidates = [...this.payslips.values()].filter(
        (payslip) =>
          (!where?.employeeId || payslip.employeeId === where.employeeId) &&
          (where?.periodMonth === undefined ||
            payslip.periodMonth === where.periodMonth) &&
          (where?.periodYear === undefined ||
            payslip.periodYear === where.periodYear),
      );
      if (orderBy) {
        candidates = candidates.sort((a, b) => {
          if (a.periodYear !== b.periodYear) return b.periodYear - a.periodYear;
          return b.periodMonth - a.periodMonth;
        });
      }
      return candidates[0] ?? null;
    },
    findMany: async ({
      where,
    }: {
      where?: {
        employeeId?: string;
        periodMonth?: number;
        periodYear?: number;
      };
    } = {}) =>
      [...this.payslips.values()]
        .filter(
          (payslip) =>
            (!where?.employeeId || payslip.employeeId === where.employeeId) &&
            (where?.periodMonth === undefined ||
              payslip.periodMonth === where.periodMonth) &&
            (where?.periodYear === undefined ||
              payslip.periodYear === where.periodYear),
        )
        .sort((a, b) =>
          a.periodYear === b.periodYear
            ? b.periodMonth - a.periodMonth
            : b.periodYear - a.periodYear,
        )
        .map((payslip) => ({
          ...this.payslipWithLineItems(payslip),
          employee: this.employees.get(payslip.employeeId)
            ? {
                departmentId: this.employees.get(payslip.employeeId)!
                  .departmentId,
              }
            : undefined,
        })),
    create: async ({
      data,
    }: {
      data: {
        payslipNumber: string;
        employeeId: string;
        periodMonth: number;
        periodYear: number;
        grossAmount: number;
        netAmount: number;
        generatedByUserId: string | null;
      };
    }) => {
      const payslip: FakePayslip = {
        id: `payslip-${this.payslips.size + 1}`,
        payslipNumber: data.payslipNumber,
        employeeId: data.employeeId,
        periodMonth: data.periodMonth,
        periodYear: data.periodYear,
        grossAmount: FakePrismaService.decimalShim(data.grossAmount),
        netAmount: FakePrismaService.decimalShim(data.netAmount),
        status: 'PROCESSING',
        paidAt: null,
        generatedByUserId: data.generatedByUserId,
        generatedAt: new Date(),
      };
      this.payslips.set(payslip.id, payslip);
      this.payslipLineItems.set(payslip.id, []);
      return payslip;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: { status: string; paidAt: Date };
    }) => {
      const payslip = this.payslips.get(where.id);
      if (!payslip) throw new Error(`no fake payslip ${where.id}`);
      Object.assign(payslip, data);
      return this.payslipWithLineItems(payslip);
    },
  };

  payslipLineItem = {
    create: async ({
      data,
    }: {
      data: {
        payslipId: string;
        type: string;
        label: string;
        amount: number;
        sortOrder: number;
      };
    }) => {
      const item: FakePayslipLineItem = {
        id: `payslip-line-item-${(this.payslipLineItems.get(data.payslipId)?.length ?? 0) + 1}-${data.payslipId}`,
        payslipId: data.payslipId,
        type: data.type,
        label: data.label,
        amount: FakePrismaService.decimalShim(data.amount),
        sortOrder: data.sortOrder,
      };
      const existing = this.payslipLineItems.get(data.payslipId) ?? [];
      existing.push(item);
      this.payslipLineItems.set(data.payslipId, existing);
      return item;
    },
  };
}
