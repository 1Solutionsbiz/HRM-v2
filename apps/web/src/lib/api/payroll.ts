import { apiFetch } from "@/lib/api-client";

export type PayslipStatus = "PROCESSING" | "PAID";
export type PayslipLineItemType = "EARNING" | "DEDUCTION";

export interface PayslipLineItem {
  id: string;
  payslipId: string;
  type: PayslipLineItemType;
  label: string;
  amount: number;
  sortOrder: number;
}

export interface PayslipEmployee {
  firstName: string;
  lastName: string;
  employeeCode: string;
  dateOfJoining: string;
  department: { name: string } | null;
  designation: { title: string } | null;
  bankDetail: { bankName: string; accountNumber: string; ifscCode: string } | null;
}

export interface Payslip {
  id: string;
  payslipNumber: string;
  employeeId: string;
  periodMonth: number;
  periodYear: number;
  grossAmount: number;
  netAmount: number;
  status: PayslipStatus;
  paidAt: string | null;
  generatedByUserId: string | null;
  generatedAt: string;
  lineItems: PayslipLineItem[];
  employee: PayslipEmployee | null;
}

export function getMyPayslips(): Promise<Payslip[]> {
  return apiFetch<Payslip[]>("/payroll/payslips/mine");
}

export type SalaryStatus = "ACTIVE" | "UNDER_REVIEW";

export interface SalaryStructure {
  id: string;
  employeeId: string;
  currentAmount: number;
  status: SalaryStatus;
  lastRevisedAt: string | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    department: { name: string } | null;
    designation: { title: string } | null;
  };
}

export function getCompanySalaries(): Promise<SalaryStructure[]> {
  return apiFetch<SalaryStructure[]>("/payroll/salary/company");
}

export interface ReviseSalaryPayload {
  newAmount: number;
  effectiveDate: string;
  reason?: string;
}

export function reviseSalary(employeeId: string, payload: ReviseSalaryPayload) {
  return apiFetch(`/payroll/employees/${employeeId}/salary/revise`, {
    method: "POST",
    body: payload,
  });
}

export interface EmployeeSalaryStructure {
  id: string;
  employeeId: string;
  currentAmount: number;
  status: SalaryStatus;
  lastRevisedAt: string | null;
}

export interface SalaryRevisionEntry {
  id: string;
  employeeId: string;
  previousAmount: number | null;
  newAmount: number;
  effectiveDate: string;
  reason: string | null;
  revisedByUserId: string;
}

export interface EmployeeSalary {
  structure: EmployeeSalaryStructure | null;
  revisions: SalaryRevisionEntry[];
}

export function getEmployeeSalary(employeeId: string): Promise<EmployeeSalary> {
  return apiFetch<EmployeeSalary>(`/payroll/employees/${employeeId}/salary`);
}

export function getEmployeePayslips(employeeId: string): Promise<Payslip[]> {
  return apiFetch<Payslip[]>(`/payroll/employees/${employeeId}/payslips`);
}

export interface PayslipLineItemInput {
  type: PayslipLineItemType;
  label: string;
  amount: number;
}

export interface GeneratePayslipPayload {
  periodMonth: number;
  periodYear: number;
  lineItems: PayslipLineItemInput[];
}

export function generatePayslip(employeeId: string, payload: GeneratePayslipPayload): Promise<Payslip> {
  return apiFetch<Payslip>(`/payroll/employees/${employeeId}/payslips`, {
    method: "POST",
    body: payload,
  });
}

export function markPayslipPaid(payslipId: string): Promise<Payslip> {
  return apiFetch<Payslip>(`/payroll/payslips/${payslipId}/mark-paid`, { method: "PATCH" });
}

export interface LateDeductionSuggestion {
  lateCount: number;
  graceOccurrences: number;
  chargeableCount: number;
  ratePerOccurrence: number;
  amount: number;
}

export function getLateDeductionSuggestion(
  employeeId: string,
  periodMonth: number,
  periodYear: number,
): Promise<LateDeductionSuggestion> {
  return apiFetch<LateDeductionSuggestion>(
    `/payroll/employees/${employeeId}/late-deduction-suggestion?periodMonth=${periodMonth}&periodYear=${periodYear}`,
  );
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthName(periodMonth: number): string {
  return MONTH_NAMES[periodMonth - 1] ?? String(periodMonth);
}
