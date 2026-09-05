import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { UsersService } from '../users/users.service.js';
import type { AuthContext } from '../common/auth-context.js';
import type { UpdateCompanySettingsDto } from './dto/update-company-settings.dto.js';

const SETTINGS_ID = 'singleton';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  async getCompanySettings() {
    const settings = await this.prisma.companySettings.findUnique({
      where: { id: SETTINGS_ID },
    });
    if (!settings) {
      // Same "fail loudly rather than guess" stance as AttendancePolicy —
      // seeded once via prisma/seed.ts, never upserted at read time.
      throw new InternalServerErrorException(
        'Company settings are not seeded — run the seed script before using this endpoint',
      );
    }
    return settings;
  }

  /**
   * Full-replace (PUT), not a merge — `website`/`phone`/`address` are
   * always overwritten with the request's value, `null` if omitted. Safe
   * because the admin form always submits the whole record (it's a single
   * form, not a per-field editor); if a partial-update caller shows up
   * later, that's a genuine PATCH, not this method reused.
   */
  async updateCompanySettings(
    dto: UpdateCompanySettingsDto,
    actor: AuthContext,
  ) {
    const updated = await this.prisma.companySettings.update({
      where: { id: SETTINGS_ID },
      data: {
        legalName: dto.legalName,
        brandName: dto.brandName,
        website: dto.website ?? null,
        supportEmail: dto.supportEmail,
        phone: dto.phone ?? null,
        address: dto.address ?? null,
        updatedByUserId: actor.userId,
      },
    });

    await this.auditService.log({
      eventType: 'SETTINGS_UPDATED',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetType: 'CompanySettings',
      targetId: SETTINGS_ID,
      description: 'Updated company settings',
    });

    return updated;
  }

  /**
   * A live view of what's actually granted — `Permission.description` per
   * role, read straight off `RolePermission`, not a hand-maintained copy
   * (the mock's `getRolePermissions` fixture was exactly that: a list that
   * could silently drift from what routes actually enforce).
   */
  async getRolePermissions() {
    const roles = await this.prisma.role.findMany({
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { label: 'asc' },
    });
    return Object.fromEntries(
      roles.map((role) => [
        role.key,
        role.rolePermissions.map(
          (rolePermission) => rolePermission.permission.description,
        ),
      ]),
    );
  }

  async getEmployeeRoles() {
    const employees = await this.prisma.employee.findMany({
      include: {
        department: { select: { name: true } },
        user: { include: { userRoles: { include: { role: true } } } },
      },
    });
    return employees.map((employee) => this.serializeEmployeeRole(employee));
  }

  async setEmployeeRole(
    employeeId: string,
    roleKey: string,
    actor: AuthContext,
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { department: { select: { name: true } } },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    // Delegates to the Users module's existing, audited (ROLE_CHANGED)
    // role-replacement logic rather than re-implementing it — this is
    // just an employee-scoped, single-role wrapper over it.
    await this.usersService.replaceRoles(employee.userId, [roleKey], actor);
    const user = await this.usersService.findOne(employee.userId);

    return {
      employeeId: employee.id,
      userId: employee.userId,
      name: `${employee.firstName} ${employee.lastName}`,
      email: user.email,
      department: employee.department?.name ?? null,
      role: user.roles[0]?.key ?? null,
    };
  }

  private serializeEmployeeRole(employee: {
    id: string;
    userId: string;
    firstName: string;
    lastName: string;
    department: { name: string } | null;
    user: { email: string; userRoles: { role: { key: string } }[] };
  }) {
    return {
      employeeId: employee.id,
      userId: employee.userId,
      name: `${employee.firstName} ${employee.lastName}`,
      email: employee.user.email,
      department: employee.department?.name ?? null,
      // Single-select assumption matches the admin UI (one role dropdown
      // per employee) — a user with more than one role only shows the
      // first here. Multi-role assignment is still possible via
      // PUT /users/:id/roles for any caller that needs it.
      role: employee.user.userRoles[0]?.role.key ?? null,
    };
  }
}
