import { describe, expect, it } from 'vitest';
import {
  toDateOnly,
  toMonthKey,
  fromMonthKey,
  shiftMonth,
  isInMonth,
  todayDateOnly,
} from './index';

describe('dates', () => {
  it('toDateOnly produces YYYY-MM-DD', () => {
    expect(toDateOnly(new Date(2026, 7, 13))).toBe('2026-08-13');
  });

  it('toMonthKey / fromMonthKey round-trip', () => {
    expect(toMonthKey(new Date(2026, 0, 31))).toBe('2026-01');
    expect(toMonthKey(fromMonthKey('2026-01'))).toBe('2026-01');
  });

  it('shiftMonth handles year boundary', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('isInMonth matches YYYY-MM', () => {
    expect(isInMonth('2026-08-13T00:00:00.000Z', '2026-08')).toBe(true);
    expect(isInMonth('2026-08-13T00:00:00.000Z', '2026-09')).toBe(false);
  });

  it('todayDateOnly returns a valid YYYY-MM-DD', () => {
    const t = todayDateOnly();
    expect(t).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
