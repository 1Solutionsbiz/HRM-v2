import { describe, expect, it } from 'vitest';
import { budgetWeightForRequest, classifyByMonthlyBudget } from './leave-budget.util.js';

const DEFAULT_TOTAL_DAYS: Record<'FULL_DAY' | 'HALF_DAY' | 'SHORT_LEAVE', number> = {
  FULL_DAY: 1,
  HALF_DAY: 0.5,
  SHORT_LEAVE: 0.25,
};

function entry(
  key: string,
  isoDate: string,
  dayType: 'FULL_DAY' | 'HALF_DAY' | 'SHORT_LEAVE',
  totalDays: number = DEFAULT_TOTAL_DAYS[dayType],
) {
  return { key, startDate: new Date(isoDate), dayType, totalDays };
}

describe('budgetWeightForRequest', () => {
  it('scales FULL_DAY by totalDays (a real multi-day range)', () => {
    expect(budgetWeightForRequest({ dayType: 'FULL_DAY', totalDays: 3 })).toBe(3);
    expect(budgetWeightForRequest({ dayType: 'FULL_DAY', totalDays: 1 })).toBe(1);
  });

  it('uses a fixed weight for HALF_DAY/SHORT_LEAVE regardless of totalDays', () => {
    expect(budgetWeightForRequest({ dayType: 'HALF_DAY', totalDays: 0.5 })).toBe(0.5);
    expect(budgetWeightForRequest({ dayType: 'SHORT_LEAVE', totalDays: 0.25 })).toBe(1 / 3);
  });
});

describe('classifyByMonthlyBudget', () => {
  it('a single full day exactly fills the budget and is free', () => {
    const result = classifyByMonthlyBudget([entry('a', '2026-09-01', 'FULL_DAY')]);
    expect(result.get('a')).toBe(true);
  });

  it('a second full day in the same month is charged', () => {
    const result = classifyByMonthlyBudget([
      entry('a', '2026-09-01', 'FULL_DAY'),
      entry('b', '2026-09-10', 'FULL_DAY'),
    ]);
    expect(result.get('a')).toBe(true);
    expect(result.get('b')).toBe(false);
  });

  it('2 half days are both free, a 3rd half day is charged', () => {
    const result = classifyByMonthlyBudget([
      entry('a', '2026-09-01', 'HALF_DAY'),
      entry('b', '2026-09-05', 'HALF_DAY'),
      entry('c', '2026-09-10', 'HALF_DAY'),
    ]);
    expect(result.get('a')).toBe(true);
    expect(result.get('b')).toBe(true);
    expect(result.get('c')).toBe(false);
  });

  it('3 short leaves in one month are all free (floating-point epsilon case)', () => {
    const result = classifyByMonthlyBudget([
      entry('a', '2026-09-01', 'SHORT_LEAVE'),
      entry('b', '2026-09-05', 'SHORT_LEAVE'),
      entry('c', '2026-09-10', 'SHORT_LEAVE'),
    ]);
    expect(result.get('a')).toBe(true);
    expect(result.get('b')).toBe(true);
    expect(result.get('c')).toBe(true);
  });

  it('a 4th short leave in the same month is charged', () => {
    const result = classifyByMonthlyBudget([
      entry('a', '2026-09-01', 'SHORT_LEAVE'),
      entry('b', '2026-09-05', 'SHORT_LEAVE'),
      entry('c', '2026-09-10', 'SHORT_LEAVE'),
      entry('d', '2026-09-15', 'SHORT_LEAVE'),
    ]);
    expect(result.get('d')).toBe(false);
  });

  it('a short leave after a full day already used the budget is charged', () => {
    const result = classifyByMonthlyBudget([
      entry('a', '2026-09-01', 'FULL_DAY'),
      entry('b', '2026-09-10', 'SHORT_LEAVE'),
    ]);
    expect(result.get('a')).toBe(true);
    expect(result.get('b')).toBe(false);
  });

  it('classifies by chronological startDate order, independent of input array order', () => {
    const result = classifyByMonthlyBudget([
      entry('later', '2026-09-20', 'FULL_DAY'),
      entry('earlier', '2026-09-01', 'FULL_DAY'),
    ]);
    // earlier date claims the free budget regardless of array position
    expect(result.get('earlier')).toBe(true);
    expect(result.get('later')).toBe(false);
  });

  /**
   * Regression test for the real incident: a 3-day approved Loss of Pay
   * request (legacy data predating the single-day-only apply flow) was
   * being scored as only 1 budget unit, so a genuinely unpaid multi-day
   * absence showed a $0 leave deduction in payroll.
   */
  it('a single 3-day FULL_DAY request alone is charged, not free (multi-day legacy data)', () => {
    const result = classifyByMonthlyBudget([entry('a', '2026-08-17', 'FULL_DAY', 3)]);
    expect(result.get('a')).toBe(false);
  });

  it('a 1-day FULL_DAY request is still free (unchanged regression guard)', () => {
    const result = classifyByMonthlyBudget([entry('a', '2026-08-17', 'FULL_DAY', 1)]);
    expect(result.get('a')).toBe(true);
  });
});
