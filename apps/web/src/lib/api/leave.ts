import { apiFetch } from "@/lib/api-client";

export type LeaveDayType = "FULL_DAY" | "HALF_DAY";
export type HalfDayPeriod = "MORNING" | "AFTERNOON";
export type LeaveRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface LeaveType {
  id: string;
  key: string;
  name: string;
  defaultAnnualDays: string | number;
  isPaid: boolean;
  requiresApproval: boolean;
  carryForwardAllowed: boolean;
  carryForwardMaxDays: string | number | null;
  isActive: boolean;
}

export function getLeaveTypes(): Promise<LeaveType[]> {
  return apiFetch<LeaveType[]>("/leave/types");
}

export interface LeaveBalance {
  leaveTypeId: string;
  leaveTypeKey: string;
  leaveTypeName: string;
  year: number;
  allocatedDays: number;
  carriedOverDays: number;
  usedDays: number;
  remainingDays: number;
}

export function getLeaveBalances(): Promise<LeaveBalance[]> {
  return apiFetch<LeaveBalance[]>("/leave/balances");
}

export function getEmployeeLeaveBalances(employeeId: string): Promise<LeaveBalance[]> {
  return apiFetch<LeaveBalance[]>(`/leave/employees/${employeeId}/balances`);
}

export interface CompanyLeaveBalanceRow {
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  department: { name: string } | null;
  designation: { title: string } | null;
  balances: LeaveBalance[];
}

export function getCompanyLeaveBalances(): Promise<CompanyLeaveBalanceRow[]> {
  return apiFetch<CompanyLeaveBalanceRow[]>("/leave/employees/company/balances");
}

export interface LeaveRequest {
  id: string;
  code: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  dayType: LeaveDayType;
  halfDayPeriod: HalfDayPeriod | null;
  totalDays: number;
  reason: string;
  status: LeaveRequestStatus;
  approverUserId: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  submittedAt: string;
  leaveType: { key: string; name: string };
}

export function getMyLeaveRequests(): Promise<LeaveRequest[]> {
  return apiFetch<LeaveRequest[]>("/leave/requests");
}

export interface ApplyLeavePayload {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  dayType?: LeaveDayType;
  halfDayPeriod?: HalfDayPeriod;
  reason: string;
}

export function applyLeave(payload: ApplyLeavePayload): Promise<LeaveRequest> {
  return apiFetch<LeaveRequest>("/leave/requests", { method: "POST", body: payload });
}

export function cancelLeaveRequest(id: string): Promise<LeaveRequest> {
  return apiFetch<LeaveRequest>(`/leave/requests/${id}/cancel`, { method: "PATCH" });
}

export interface CompanyLeaveRequest extends LeaveRequest {
  employee: { id: string; firstName: string; lastName: string };
}

export function getCompanyLeaveRequests(): Promise<CompanyLeaveRequest[]> {
  return apiFetch<CompanyLeaveRequest[]>("/leave/requests/company");
}

export function decideLeaveRequest(
  id: string,
  decision: "APPROVED" | "REJECTED",
  decisionNote?: string,
): Promise<LeaveRequest> {
  return apiFetch<LeaveRequest>(`/leave/requests/${id}/decide`, {
    method: "PATCH",
    body: { decision, decisionNote },
  });
}
