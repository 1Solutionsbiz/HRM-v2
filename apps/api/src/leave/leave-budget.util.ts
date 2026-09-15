import { LeaveDayType } from '../generated/prisma/enums.js';

/** Weight consumed against the 1-day monthly free allowance. */
export const BUDGET_WEIGHT: Record<LeaveDayType, number> = {
  FULL_DAY: 1,
  HALF_DAY: 0.5,
  SHORT_LEAVE: 1 / 3,
};

/**
 * Salary-deduction weight once the monthly free allowance is exhausted —
 * deliberately not the same fraction as BUDGET_WEIGHT for SHORT_LEAVE (1/4,
 * not 1/3). Specified directly by the user (2026-09-15), not a rounding of
 * the budget weight.
 */
export const DEDUCTION_TOTAL_DAYS: Record<LeaveDayType, number> = {
  FULL_DAY: 1,
  HALF_DAY: 0.5,
  SHORT_LEAVE: 0.25,
};

export const MONTHLY_FREE_BUDGET = 1;

// 1/3 three times over does not exactly equal 1 in floating point.
const BUDGET_EPSILON = 1e-9;

/**
 * Walks entries in chronological order, accumulating BUDGET_WEIGHT, and
 * returns which are free vs. chargeable against the monthly allowance.
 * Shared by LeaveService.applyLeave (existing committed requests this month
 * plus the new one) and PayrollService's payslip preview (all approved
 * requests this month) so the two can never drift on the budget math.
 */
export function classifyByMonthlyBudget<
  T extends { key: string; startDate: Date; dayType: LeaveDayType },
>(entries: T[]): Map<string, boolean> {
  const sorted = [...entries].sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime(),
  );
  let committed = 0;
  const result = new Map<string, boolean>();
  for (const entry of sorted) {
    const weight = BUDGET_WEIGHT[entry.dayType];
    result.set(entry.key, committed + weight <= MONTHLY_FREE_BUDGET + BUDGET_EPSILON);
    committed += weight;
  }
  return result;
}
