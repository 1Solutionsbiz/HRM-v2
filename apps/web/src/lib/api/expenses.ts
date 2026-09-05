import { apiFetch } from "@/lib/api-client";

export type ExpenseClaimStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
  monthlyCapAmount: string | number | null;
  isActive: boolean;
}

export function getExpenseCategories(): Promise<ExpenseCategory[]> {
  return apiFetch<ExpenseCategory[]>("/expenses/categories");
}

export interface ExpenseClaim {
  id: string;
  code: string;
  employeeId: string;
  categoryId: string;
  amount: number;
  currency: string;
  expenseDate: string;
  description: string;
  receiptUrl: string | null;
  status: ExpenseClaimStatus;
  approverUserId: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  submittedAt: string;
  category: { name: string };
}

export function getMyExpenseClaims(): Promise<ExpenseClaim[]> {
  return apiFetch<ExpenseClaim[]>("/expenses/claims");
}

export interface SubmitExpenseClaimPayload {
  categoryId: string;
  amount: number;
  expenseDate: string;
  description: string;
  receiptUrl?: string;
}

export function submitExpenseClaim(payload: SubmitExpenseClaimPayload): Promise<ExpenseClaim> {
  return apiFetch<ExpenseClaim>("/expenses/claims", { method: "POST", body: payload });
}

export function cancelExpenseClaim(id: string): Promise<ExpenseClaim> {
  return apiFetch<ExpenseClaim>(`/expenses/claims/${id}/cancel`, { method: "PATCH" });
}

export interface CompanyExpenseClaim extends ExpenseClaim {
  employee: { id: string; firstName: string; lastName: string };
}

export function getCompanyExpenseClaims(): Promise<CompanyExpenseClaim[]> {
  return apiFetch<CompanyExpenseClaim[]>("/expenses/claims/company");
}

export function decideExpenseClaim(
  id: string,
  decision: "APPROVED" | "REJECTED",
  decisionNote?: string,
): Promise<ExpenseClaim> {
  return apiFetch<ExpenseClaim>(`/expenses/claims/${id}/decide`, {
    method: "PATCH",
    body: { decision, decisionNote },
  });
}
