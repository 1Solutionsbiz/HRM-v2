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
}

export function getMyPayslips(): Promise<Payslip[]> {
  return apiFetch<Payslip[]>("/payroll/payslips/mine");
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthName(periodMonth: number): string {
  return MONTH_NAMES[periodMonth - 1] ?? String(periodMonth);
}
