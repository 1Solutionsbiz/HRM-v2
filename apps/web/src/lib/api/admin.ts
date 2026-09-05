import { apiFetch } from "@/lib/api-client";
import type { Role } from "@/types/role";

export interface CompanySettings {
  id: string;
  legalName: string;
  brandName: string;
  website: string | null;
  supportEmail: string;
  phone: string | null;
  address: string | null;
  timezone: string;
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
