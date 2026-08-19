import { describe, expect, it } from 'vitest';
import {
  toDateOnly,
  toMonthKey,
  fromMonthKey,
  shiftMonth,
  monthDateRange,
  isInMonth,
  todayDateOnly,
  isValidDateOnly,
  isValidMonthKey,
  formatHumanDate,
} from './index';

describe('dates', () => {
  it('toDateOnly produces YYYY-MM-DD', () => {
    expect(toDateOnly(new Date(2026, 7, 13))).toBe('2026-08-13');
  });

  it('validates real calendar dates', () => {
    expect(isValidDateOnly('2026-02-28')).toBe(true);
    expect(isValidDateOnly('2024-02-29')).toBe(true);
    expect(isValidDateOnly('2026-02-30')).toBe(false);
    expect(isValidDateOnly('2026-04-31')).toBe(false);
    expect(isValidDateOnly('2026-13-01')).toBe(false);
  });

  it('validates month keys', () => {
    expect(isValidMonthKey('2026-01')).toBe(true);
    expect(isValidMonthKey('2026-12')).toBe(true);
    expect(isValidMonthKey('2026-00')).toBe(false);
    expect(isValidMonthKey('2026-13')).toBe(false);
  });

  it('toMonthKey / fromMonthKey round-trip', () => {
    expect(toMonthKey(new Date(2026, 0, 31))).toBe('2026-01');
    expect(toMonthKey(fromMonthKey('2026-01'))).toBe('2026-01');
  });

  it('shiftMonth handles year boundary', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('monthDateRange uses an exclusive next-month boundary', () => {
    expect(monthDateRange('2026-02')).toEqual({
      fromInclusive: '2026-02-01',
      toExclusive: '2026-03-01',
    });
    expect(monthDateRange('2026-12')).toEqual({
      fromInclusive: '2026-12-01',
      toExclusive: '2027-01-01',
    });
  });

  it('isInMonth matches YYYY-MM', () => {
    expect(isInMonth('2026-08-13T00:00:00.000Z', '2026-08')).toBe(true);
    expect(isInMonth('2026-08-13T00:00:00.000Z', '2026-09')).toBe(false);
  });

  it('formats date-only values as local calendar dates', () => {
    const expected = new Date(2026, 7, 13).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    expect(formatHumanDate('2026-08-13')).toBe(expected);
  });

  it('todayDateOnly returns a valid YYYY-MM-DD', () => {
    const t = todayDateOnly();
    expect(isValidDateOnly(t)).toBe(true);
  });
});
