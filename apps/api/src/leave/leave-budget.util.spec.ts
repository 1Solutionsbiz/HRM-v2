import { describe, expect, it } from 'vitest';
import { classifyByMonthlyBudget } from './leave-budget.util.js';

function entry(key: string, isoDate: string, dayType: 'FULL_DAY' | 'HALF_DAY' | 'SHORT_LEAVE') {
  return { key, startDate: new Date(isoDate), dayType };
}

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
});
