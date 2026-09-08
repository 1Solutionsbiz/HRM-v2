import { apiFetch } from "@/lib/api-client";

export type OperatingExpenseCategory = "RENT" | "ELECTRICITY" | "INTERNET" | "MISCELLANEOUS";

export interface OperatingExpenseEntry {
  category: OperatingExpenseCategory;
  amount: number;
  note: string | null;
  updatedAt: string | null;
}

export interface OperatingExpensesForPeriod {
  periodMonth: number;
  periodYear: number;
  entries: OperatingExpenseEntry[];
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
  periodMonth: number;
  periodYear: number;
  amount: number;
  note?: string;
}

export function upsertOperatingExpense(payload: UpsertOperatingExpensePayload) {
  return apiFetch("/operating-expenses", { method: "POST", body: payload });
}

export const OPERATING_EXPENSE_LABEL: Record<OperatingExpenseCategory, string> = {
  RENT: "Rent",
  ELECTRICITY: "Electricity",
  INTERNET: "Internet",
  MISCELLANEOUS: "Miscellaneous",
};
