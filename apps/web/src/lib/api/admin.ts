import { apiFetch } from "@/lib/api-client";

export interface AuditLogEntry {
  id: string;
  occurredAt: string;
  eventType: string;
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

export interface CompanySettings {
  id: string;
  legalName: string;
  brandName: string;
  website: string | null;
  supportEmail: string;
  phone: string | null;
  address: string | null;
  timezone: string;
}

export function getCompanySettings(): Promise<CompanySettings> {
  return apiFetch<CompanySettings>("/admin/company-settings");
}

export interface EmployeeRoleRow {
  employeeId: string;
  userId: string;
  name: string;
  email: string;
  department: string | null;
  role: string | null;
}

export function getEmployeeRoles(): Promise<EmployeeRoleRow[]> {
  return apiFetch<EmployeeRoleRow[]>("/admin/roles/employees");
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
