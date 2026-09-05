import * as fixtures from "./fixtures";
import * as hr from "./hr-fixtures";
import type {
  AttendanceDay,
  ExpenseClaim,
  LeaveRequest,
  RequestStatus,
} from "./fixtures";
import type {
  AuditLogEntry,
  CompanyExpenseClaim,
  CompanyLeaveRequest,
  CompanyProfile,
  DirectoryEmployee,
  OnboardingCandidate,
  ResignationRequest,
  SalaryRecord,
} from "./hr-fixtures";
import type { Role } from "@/types/role";

/**
 * Simulated backend. Every exported function here returns a Promise, the
 * same shape a real API client would, so screens go through genuine
 * loading/error states rather than reading synchronous fixtures directly.
 *
 * Mutable collections (attendance-today, leave requests, expense claims,
 * notification read-state) live in module-level memory, seeded from
 * fixtures.ts, and reset on a full page reload - there is no backend to
 * persist them yet. That's an intentional, documented limitation of this
 * preview build, not an oversight.
 */

const DEFAULT_DELAY = 500;

function shouldForceError(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("mockError") === "1";
}

function simulate<T>(data: T, delay = DEFAULT_DELAY): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldForceError()) {
        reject(new Error("Simulated network error"));
      } else {
        resolve(data);
      }
    }, delay);
  });
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export type TodayAttendanceStatus = "not-checked-in" | "checked-in" | "checked-out";

export interface TodayAttendance {
  status: TodayAttendanceStatus;
  checkInTime: string | null;
  checkOutTime: string | null;
}

let todayAttendance: TodayAttendance = {
  status: "not-checked-in",
  checkInTime: null,
  checkOutTime: null,
};

export function getTodayAttendance() {
  return simulate({ ...todayAttendance });
}

export function checkIn() {
  const now = new Date();
  todayAttendance = {
    status: "checked-in",
    checkInTime: now.toISOString(),
    checkOutTime: null,
  };
  return simulate({ ...todayAttendance }, 700);
}

export function checkOut() {
  const now = new Date();
  todayAttendance = { ...todayAttendance, status: "checked-out", checkOutTime: now.toISOString() };
  return simulate({ ...todayAttendance }, 700);
}

export function getAttendanceHistory(): Promise<AttendanceDay[]> {
  return simulate([...fixtures.attendanceHistory]);
}

export function getOfficeTiming() {
  return simulate({ ...fixtures.officeTiming });
}

// ---------------------------------------------------------------------------
// Leave
// ---------------------------------------------------------------------------

let leaveRequestStore: LeaveRequest[] = [...fixtures.leaveRequests];

export function getLeaveBalances() {
  return simulate([...fixtures.leaveBalances]);
}

export function getLeaveRequests() {
  return simulate([...leaveRequestStore].sort((a, b) => (a.appliedOn < b.appliedOn ? 1 : -1)));
}

export interface ApplyLeavePayload {
  type: string;
  startDate: string;
  endDate: string;
  dayType: "Full Day" | "Half Day";
  reason: string;
}

function daysBetween(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(ms / 86400000) + 1;
}

export function applyLeave(payload: ApplyLeavePayload) {
  const request: LeaveRequest = {
    id: `LV-${Math.floor(1000 + Math.random() * 9000)}`,
    type: payload.type,
    startDate: payload.startDate,
    endDate: payload.endDate,
    days: payload.dayType === "Half Day" ? 0.5 : daysBetween(payload.startDate, payload.endDate),
    dayType: payload.dayType,
    reason: payload.reason,
    status: "Pending",
    appliedOn: new Date().toISOString().slice(0, 10),
    approver: fixtures.currentEmployee.manager,
  };
  leaveRequestStore = [request, ...leaveRequestStore];
  return simulate(request, 800);
}

export function cancelLeaveRequest(id: string) {
  leaveRequestStore = leaveRequestStore.map((r) =>
    r.id === id ? { ...r, status: "Cancelled" as RequestStatus } : r,
  );
  return simulate(true, 500);
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

let expenseStore: ExpenseClaim[] = [...fixtures.expenseClaims];

export function getExpenseClaims() {
  return simulate([...expenseStore].sort((a, b) => (a.submittedOn < b.submittedOn ? 1 : -1)));
}

export interface AddExpensePayload {
  category: string;
  amount: number;
  date: string;
  description: string;
  receiptName?: string;
}

export function addExpense(payload: AddExpensePayload) {
  const claim: ExpenseClaim = {
    id: `EX-${Math.floor(1000 + Math.random() * 9000)}`,
    category: payload.category,
    amount: payload.amount,
    date: payload.date,
    description: payload.description,
    status: "Pending",
    receiptName: payload.receiptName,
    submittedOn: new Date().toISOString().slice(0, 10),
  };
  expenseStore = [claim, ...expenseStore];
  return simulate(claim, 800);
}

// ---------------------------------------------------------------------------
// Payslips / documents / performance / announcements
// ---------------------------------------------------------------------------

export function getPayslips() {
  return simulate([...fixtures.payslips]);
}

export function getDocuments() {
  return simulate([...fixtures.documents]);
}

export function getPerformance() {
  return simulate(fixtures.performance);
}

export function getAnnouncements() {
  return simulate([...fixtures.announcements]);
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

let notificationStore = [...fixtures.notifications];

/**
 * The topbar's notification bell and the /notifications page each hold
 * their own fetched copy (no shared cache in this lightweight setup) - this
 * lets the bell refetch when the page mutates read-state, so "mark as read"
 * is reflected immediately everywhere instead of only after a reload.
 */
const notificationListeners = new Set<() => void>();

export function subscribeToNotificationChanges(listener: () => void) {
  notificationListeners.add(listener);
  return () => {
    notificationListeners.delete(listener);
  };
}

function announceNotificationsChanged() {
  notificationListeners.forEach((listener) => listener());
}

export function getNotifications() {
  return simulate([...notificationStore]);
}

export function markNotificationRead(id: string) {
  notificationStore = notificationStore.map((n) => (n.id === id ? { ...n, read: true } : n));
  announceNotificationsChanged();
  return simulate(true, 250);
}

export function markAllNotificationsRead() {
  notificationStore = notificationStore.map((n) => ({ ...n, read: true }));
  announceNotificationsChanged();
  return simulate(true, 300);
}

// ---------------------------------------------------------------------------
// My Day aggregate
// ---------------------------------------------------------------------------

export function getTodaysTasks() {
  return simulate([...fixtures.todaysTasks]);
}

export function getTodaysMeetings() {
  return simulate([...fixtures.todaysMeetings]);
}

export interface MyDaySummary {
  attendance: TodayAttendance;
  leaveBalances: typeof fixtures.leaveBalances;
  pendingRequestsCount: number;
  unreadNotificationsCount: number;
  unreadAnnouncementsCount: number;
  tasks: typeof fixtures.todaysTasks;
  meetings: typeof fixtures.todaysMeetings;
  performance: typeof fixtures.performance;
}

export function getMyDaySummary(): Promise<MyDaySummary> {
  return simulate(
    {
      attendance: { ...todayAttendance },
      leaveBalances: [...fixtures.leaveBalances],
      pendingRequestsCount:
        leaveRequestStore.filter((r) => r.status === "Pending").length +
        expenseStore.filter((e) => e.status === "Pending").length,
      unreadNotificationsCount: notificationStore.filter((n) => !n.read).length,
      unreadAnnouncementsCount: fixtures.announcements.filter((a) => !a.read).length,
      tasks: [...fixtures.todaysTasks],
      meetings: [...fixtures.todaysMeetings],
      performance: fixtures.performance,
    },
    650,
  );
}

// ---------------------------------------------------------------------------
// Unified "my requests" view (leave + expense)
// ---------------------------------------------------------------------------

export interface UnifiedRequest {
  id: string;
  kind: "Leave" | "Expense";
  title: string;
  detail: string;
  status: RequestStatus;
  submittedOn: string;
}

export function getMyRequests(): Promise<UnifiedRequest[]> {
  const leave: UnifiedRequest[] = leaveRequestStore.map((r) => ({
    id: r.id,
    kind: "Leave",
    title: `${r.type} · ${r.dayType}`,
    detail:
      r.startDate === r.endDate
        ? r.startDate
        : `${r.startDate} → ${r.endDate}`,
    status: r.status,
    submittedOn: r.appliedOn,
  }));
  const expense: UnifiedRequest[] = expenseStore.map((e) => ({
    id: e.id,
    kind: "Expense",
    title: e.category,
    detail: `₹${e.amount.toLocaleString("en-IN")} · ${e.description}`,
    status: e.status,
    submittedOn: e.submittedOn,
  }));
  return simulate(
    [...leave, ...expense].sort((a, b) => (a.submittedOn < b.submittedOn ? 1 : -1)),
  );
}

// ---------------------------------------------------------------------------
// Login (mock only - no real auth)
// ---------------------------------------------------------------------------

export function mockLogin(email: string, password: string) {
  return new Promise<{ ok: true }>((resolve, reject) => {
    setTimeout(() => {
      if (email.trim().length === 0 || password.length === 0) {
        reject(new Error("Enter your email and password."));
        return;
      }
      if (password.length < 4) {
        reject(new Error("Incorrect email or password."));
        return;
      }
      resolve({ ok: true });
    }, 700);
  });
}

// ---------------------------------------------------------------------------
// HR / Admin: company-wide data
// ---------------------------------------------------------------------------
// Same simulate()/mutable-store pattern as above, sourced from hr-fixtures.ts
// (company-wide) instead of fixtures.ts (current-employee-scoped).

export function getCompanyHeadcountSummary() {
  return simulate({ ...hr.companyHeadcountSummary });
}

export function getEmployeeDirectory(): Promise<DirectoryEmployee[]> {
  return simulate([...hr.employeeDirectory]);
}

let companyLeaveStore: CompanyLeaveRequest[] = [...hr.companyLeaveRequests];
let companyExpenseStore: CompanyExpenseClaim[] = [...hr.companyExpenseClaims];

export function getCompanyLeaveRequests() {
  return simulate(
    [...companyLeaveStore].sort((a, b) => (a.submittedOn < b.submittedOn ? 1 : -1)),
  );
}

export function decideCompanyLeaveRequest(id: string, decision: "Approved" | "Rejected") {
  companyLeaveStore = companyLeaveStore.map((r) => (r.id === id ? { ...r, status: decision } : r));
  return simulate(true, 500);
}

export function getCompanyExpenseClaims() {
  return simulate(
    [...companyExpenseStore].sort((a, b) => (a.submittedOn < b.submittedOn ? 1 : -1)),
  );
}

export function decideCompanyExpenseClaim(id: string, decision: "Approved" | "Rejected") {
  companyExpenseStore = companyExpenseStore.map((e) => (e.id === id ? { ...e, status: decision } : e));
  return simulate(true, 500);
}

export function getNewJoiners() {
  return simulate([...hr.newJoiners]);
}

export function getUpcomingBirthdays() {
  return simulate([...hr.upcomingBirthdays]);
}

export function getOnboardingCandidates(): Promise<OnboardingCandidate[]> {
  return simulate([...hr.onboardingCandidates]);
}

let resignationStore: ResignationRequest[] = [...hr.resignationRequests];

export function getResignationRequests() {
  return simulate(
    [...resignationStore].sort((a, b) => (a.submittedOn < b.submittedOn ? 1 : -1)),
  );
}

export function decideResignationRequest(id: string, decision: "Approved" | "Declined") {
  resignationStore = resignationStore.map((r) => (r.id === id ? { ...r, status: decision } : r));
  return simulate(true, 600);
}

export function getSalaryRecords(): Promise<SalaryRecord[]> {
  return simulate([...hr.salaryRecords]);
}

export function getPayrollTrend() {
  return simulate([...hr.payrollMonthlyTrend]);
}

export function getPayrollByDepartment() {
  return simulate([...hr.payrollByDepartment]);
}

export interface EmployeeRoleRow {
  employeeId: string;
  name: string;
  email: string;
  department: string;
  role: Role;
}

function seedRoleFor(employeeId: string): Role {
  if (employeeId === "E7") return "admin"; // Karan Mehta - System Administrator
  if (employeeId === "E6") return "hr"; // Priya Nair - HR Business Partner
  if (employeeId === "E2") return "manager"; // Rahul Verma - Engineering Manager
  return "employee";
}

let employeeRoleStore: EmployeeRoleRow[] = hr.employeeDirectory.map((e) => ({
  employeeId: e.id,
  name: e.name,
  email: e.email,
  department: e.department,
  role: seedRoleFor(e.id),
}));

export function getEmployeeRoles() {
  return simulate([...employeeRoleStore]);
}

export function updateEmployeeRole(employeeId: string, role: Role) {
  employeeRoleStore = employeeRoleStore.map((r) => (r.employeeId === employeeId ? { ...r, role } : r));
  return simulate(true, 500);
}

export function getRolePermissions() {
  return simulate({ ...hr.rolePermissions });
}

export function getAuditLogs(): Promise<AuditLogEntry[]> {
  return simulate([...hr.auditLogs]);
}

let companyProfileStore = { ...hr.companyProfile };

export function getCompanyProfile() {
  return simulate({ ...companyProfileStore });
}

export function updateCompanyProfile(payload: CompanyProfile) {
  companyProfileStore = { ...payload };
  return simulate({ ...companyProfileStore }, 600);
}
