import { apiFetch } from "@/lib/api-client";

export type StandardOperatingExpenseCategory = "RENT" | "ELECTRICITY" | "INTERNET" | "MISCELLANEOUS";
export type OperatingExpenseCategory = StandardOperatingExpenseCategory | "CUSTOM";

export interface OperatingExpenseEntry {
  category: StandardOperatingExpenseCategory;
  amount: number;
  note: string | null;
  updatedAt: string | null;
}

export interface CustomOperatingExpenseEntry {
  id: string;
  label: string;
  amount: number;
  note: string | null;
  updatedAt: string | null;
}

export interface OperatingExpensesForPeriod {
  periodMonth: number;
  periodYear: number;
  entries: OperatingExpenseEntry[];
  custom: CustomOperatingExpenseEntry[];
  total: number;
}

export function getOperatingExpenses(periodMonth?: number, periodYear?: number): Promise<OperatingExpensesForPeriod> {
  const search = new URLSearchParams();
  if (periodMonth) search.set("periodMonth", String(periodMonth));
  if (periodYear) search.set("periodYear", String(periodYear));
  const qs = search.toString();
  return apiFetch<OperatingExpensesForPeriod>(`/operating-expenses${qs ? `?${qs}` : ""}`);
}

export interface UpsertOperatingExpensePayload {
  category: OperatingExpenseCategory;
  label?: string;
  periodMonth: number;
  periodYear: number;
  amount: number;
  note?: string;
}

export function upsertOperatingExpense(payload: UpsertOperatingExpensePayload) {
  return apiFetch("/operating-expenses", { method: "POST", body: payload });
}

export function deleteOperatingExpense(id: string) {
  return apiFetch(`/operating-expenses/${id}`, { method: "DELETE" });
}

export const OPERATING_EXPENSE_LABEL: Record<StandardOperatingExpenseCategory, string> = {
  RENT: "Rent",
  ELECTRICITY: "Electricity",
  INTERNET: "Internet",
  MISCELLANEOUS: "Miscellaneous",
};
