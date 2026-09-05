import { IsString } from 'class-validator';

/**
 * Single role, not the full multi-role set `PUT /users/:id/roles` accepts —
 * the admin "Roles & permissions" screen is a one-role-per-employee
 * dropdown. Multi-role assignment still exists via the Users endpoint for
 * any caller that needs it; this one always replaces the set with exactly
 * one role.
 */
export class AssignEmployeeRoleDto {
  @IsString()
  roleKey!: string;
}
