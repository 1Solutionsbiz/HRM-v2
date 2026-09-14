import { describe, expect, it } from 'vitest';
import { addDays, formatDateOnly, parseDateOnly, toDateOnly } from './date-only.js';

describe('toDateOnly', () => {
  it('resolves to the Asia/Kolkata calendar day, not the host process timezone', () => {
    // 19:21 UTC on Sep 14 is already 00:51 IST on Sep 15 - the exact
    // production incident this test guards against (2026-09-15): a UTC-
    // configured host used to read this as "still Sep 14" for roughly
    // 5.5 hours after real midnight IST every night.
    const result = toDateOnly(new Date('2026-09-14T19:21:50.161Z'));
    expect(formatDateOnly(result)).toBe('2026-09-15');
  });

  it('is correct right at the IST midnight boundary (18:30 UTC)', () => {
    expect(formatDateOnly(toDateOnly(new Date('2026-09-14T18:29:59.999Z')))).toBe('2026-09-14');
    expect(formatDateOnly(toDateOnly(new Date('2026-09-14T18:30:00.000Z')))).toBe('2026-09-15');
  });

  it('matches the host-local-getter result on a host actually configured for Asia/Kolkata (no behavior change for a correctly configured host)', () => {
    // A punch mid-afternoon IST is unambiguous regardless of which
    // timezone resolution strategy is used.
    const result = toDateOnly(new Date('2026-09-14T09:00:00.000Z')); // 14:30 IST
    expect(formatDateOnly(result)).toBe('2026-09-14');
  });
});

describe('parseDateOnly / addDays / formatDateOnly', () => {
  it('round-trips a plain date-only string without shifting', () => {
    const date = parseDateOnly('2026-09-15');
    expect(formatDateOnly(date)).toBe('2026-09-15');
  });

  it('addDays stays UTC-only date-math, unaffected by the Intl-based toDateOnly change', () => {
    const date = parseDateOnly('2026-09-15');
    expect(formatDateOnly(addDays(date, 1))).toBe('2026-09-16');
    expect(formatDateOnly(addDays(date, -1))).toBe('2026-09-14');
  });
});
