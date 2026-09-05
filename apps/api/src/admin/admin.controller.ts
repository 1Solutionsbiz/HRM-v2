import { Body, Controller, Get, Param, Patch, Put } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { AdminService } from './admin.service.js';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto.js';
import { AssignEmployeeRoleDto } from './dto/assign-employee-role.dto.js';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('company-settings')
  @RequirePermissions('company:manage')
  getCompanySettings() {
    return this.adminService.getCompanySettings();
  }

  @Put('company-settings')
  @RequirePermissions('company:manage')
  updateCompanySettings(
    @Body() dto: UpdateCompanySettingsDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.adminService.updateCompanySettings(dto, actor);
  }

  @Get('roles/permissions')
  @RequirePermissions('user:manage')
  getRolePermissions() {
    return this.adminService.getRolePermissions();
  }

  @Get('roles/employees')
  @RequirePermissions('user:manage')
  getEmployeeRoles() {
    return this.adminService.getEmployeeRoles();
  }

  @Patch('roles/employees/:employeeId')
  @RequirePermissions('user:manage')
  setEmployeeRole(
    @Param('employeeId') employeeId: string,
    @Body() dto: AssignEmployeeRoleDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.adminService.setEmployeeRole(employeeId, dto.roleKey, actor);
  }
}
