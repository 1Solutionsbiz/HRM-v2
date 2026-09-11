import { apiFetch } from "@/lib/api-client";
import type { Role } from "@/types/role";
import type { DailyReportTemplate } from "@/lib/api/daily-reports";

export interface CompanySettings {
  id: string;
  legalName: string;
  brandName: string;
  website: string | null;
  supportEmail: string;
  phone: string | null;
  address: string | null;
  timezone: string;
  geofenceLatitude: number | null;
  geofenceLongitude: number | null;
  geofenceRadiusMeters: number | null;
  dailyReportRequired: boolean;
  dailyReportDeadline: string | null;
  dailyReportGraceMinutes: number | null;
  updatedAt: string;
  updatedByUserId: string | null;
}

export function getCompanySettings(): Promise<CompanySettings> {
  return apiFetch<CompanySettings>("/admin/company-settings");
}

export interface UpdateCompanySettingsPayload {
  legalName: string;
  brandName: string;
  website?: string;
  supportEmail: string;
  phone?: string;
  address?: string;
}

export function updateCompanySettings(payload: UpdateCompanySettingsPayload): Promise<CompanySettings> {
  return apiFetch<CompanySettings>("/admin/company-settings", { method: "PUT", body: payload });
}

export interface UpdateGeofenceSettingsPayload {
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
}

export function updateGeofenceSettings(payload: UpdateGeofenceSettingsPayload): Promise<CompanySettings> {
  return apiFetch<CompanySettings>("/admin/company-settings/geofence", { method: "PUT", body: payload });
}

export interface UpdateDailyReportPolicyPayload {
  required?: boolean;
  /** 24-hour "HH:mm", company local time. */
  deadline?: string;
  graceMinutes?: number;
}

export function updateDailyReportPolicy(payload: UpdateDailyReportPolicyPayload): Promise<CompanySettings> {
  return apiFetch<CompanySettings>("/admin/company-settings/daily-report-policy", { method: "PUT", body: payload });
}

export type RolePermissions = Record<Role, string[]>;

export function getRolePermissions(): Promise<RolePermissions> {
  return apiFetch<RolePermissions>("/admin/roles/permissions");
}

export interface EmployeeRoleRow {
  employeeId: string;
  userId: string;
  name: string;
  email: string;
  department: string | null;
  role: Role | null;
}

export function getEmployeeRoles(): Promise<EmployeeRoleRow[]> {
  return apiFetch<EmployeeRoleRow[]>("/admin/roles/employees");
}

export function setEmployeeRole(employeeId: string, roleKey: Role): Promise<EmployeeRoleRow> {
  return apiFetch<EmployeeRoleRow>(`/admin/roles/employees/${employeeId}`, {
    method: "PATCH",
    body: { roleKey },
  });
}

export interface PasswordResetResult {
  id: string;
  email: string;
  /** Shown once - the server never stores or returns this again. */
  temporaryPassword: string;
}

export function resetUserPassword(userId: string): Promise<PasswordResetResult> {
  return apiFetch<PasswordResetResult>(`/users/${userId}/reset-password`, { method: "POST" });
}

/**
 * Deactivating immediately revokes every active session for this user
 * (JwtAuthGuard re-checks isActive on every request) - so this takes
 * effect on their very next tap, not at token expiry.
 */
export function setUserActiveStatus(userId: string, isActive: boolean): Promise<{ id: string; isActive: boolean }> {
  return apiFetch<{ id: string; isActive: boolean }>(`/users/${userId}/status`, {
    method: "PATCH",
    body: { isActive },
  });
}

export type AuditEventType =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "ROLE_CHANGED"
  | "PASSWORD_CHANGED"
  | "DOCUMENT_UPDATED"
  | "SETTINGS_UPDATED"
  | "EMPLOYEE_CREATED"
  | "EMPLOYEE_UPDATED"
  | "USER_CREATED"
  | "USER_STATUS_CHANGED"
  | "OTHER";

export interface AuditLogEntry {
  id: string;
  occurredAt: string;
  eventType: AuditEventType;
  description: string;
  actorName: string;
  actorEmail: string | null;
  targetType: string | null;
  targetId: string | null;
  ipAddress: string | null;
  status: "SUCCESS" | "FAILED";
}

export function getAuditLogs(limit = 100): Promise<AuditLogEntry[]> {
  return apiFetch<AuditLogEntry[]>(`/audit/logs?limit=${limit}`);
}

export type ResignationStatus = "PENDING" | "APPROVED" | "DECLINED" | "WITHDRAWN";

export interface CompanyResignation {
  id: string;
  employeeId: string;
  reason: string;
  submittedAt: string;
  lastWorkingDay: string;
  noticePeriodDays: number;
  status: ResignationStatus;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    designation: { title: string } | null;
  };
}

export function getCompanyResignations(): Promise<CompanyResignation[]> {
  return apiFetch<CompanyResignation[]>("/resignations/company");
}

export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface CompanyLeaveRequest {
  id: string;
  status: RequestStatus;
  totalDays: number;
  employee: { id: string; firstName: string; lastName: string };
}

export function getCompanyLeaveRequests(): Promise<CompanyLeaveRequest[]> {
  return apiFetch<CompanyLeaveRequest[]>("/leave/requests/company");
}

export interface CompanyExpenseClaim {
  id: string;
  status: RequestStatus;
  amount: number;
  employee: { id: string; firstName: string; lastName: string };
}

export function getCompanyExpenseClaims(): Promise<CompanyExpenseClaim[]> {
  return apiFetch<CompanyExpenseClaim[]>("/expenses/claims/company");
}

export interface DepartmentRow {
  id: string;
  name: string;
  code: string | null;
}

export function getDepartments(): Promise<DepartmentRow[]> {
  return apiFetch<DepartmentRow[]>("/departments");
}

export interface DesignationRow {
  id: string;
  title: string;
  department: { id: string; name: string };
  /** The default Daily Work Report template for anyone holding this designation, unless a per-employee override is set - see Employee.dailyReportTemplateOverride. Falls back to GENERAL when null. */
  dailyReportTemplate: DailyReportTemplate | null;
}

export function getDesignations(): Promise<DesignationRow[]> {
  return apiFetch<DesignationRow[]>("/designations");
}

export function updateDesignationTemplate(
  id: string,
  dailyReportTemplate: DailyReportTemplate | null,
): Promise<DesignationRow> {
  return apiFetch<DesignationRow>(`/designations/${id}`, { method: "PATCH", body: { dailyReportTemplate } });
}
