import { describe, expect, it } from 'vitest';
import {
  allocateEqual,
  allocateByPercentage,
  allocateByShares,
  decimalToMinor,
  formatMoney,
  minorToDecimal,
  parseMoney,
  sumMinor,
  assertSumsTo,
  currencyDecimals,
} from './index';

describe('decimalToMinor / minorToDecimal', () => {
  it('round-trips common cases', () => {
    expect(decimalToMinor('1250.50', 'INR')).toBe(125050);
    expect(minorToDecimal(125050, 'INR')).toBe(1250.5);
  });

  it('handles zero', () => {
    expect(decimalToMinor('0', 'INR')).toBe(0);
    expect(decimalToMinor('0.00', 'INR')).toBe(0);
  });

  it('handles negative amounts', () => {
    expect(decimalToMinor('-12.34', 'USD')).toBe(-1234);
    expect(minorToDecimal(-1234, 'USD')).toBeCloseTo(-12.34);
  });

  it('handles JPY (zero decimal)', () => {
    expect(decimalToMinor('100', 'JPY')).toBe(100);
    // JPY has 0 decimal places — fraction is discarded (truncated).
    expect(decimalToMinor('100.5', 'JPY')).toBe(100);
    expect(currencyDecimals('JPY')).toBe(0);
  });

  it('throws on invalid input', () => {
    expect(() => decimalToMinor('abc', 'INR')).toThrow();
    expect(() => decimalToMinor('1.2.3', 'INR')).toThrow();
  });
});

describe('formatMoney', () => {
  it('formats INR with rupee symbol', () => {
    const formatted = formatMoney({ amountMinor: 125050, currency: 'INR' });
    expect(formatted).toMatch(/1,250\.50|1250\.50/);
  });

  it('formats zero', () => {
    const formatted = formatMoney({ amountMinor: 0, currency: 'USD' });
    expect(formatted).toMatch(/0\.00/);
  });
});

describe('parseMoney', () => {
  it('strips thousands separators and currency symbols', () => {
    expect(parseMoney('₹1,250.50', 'INR').amountMinor).toBe(125050);
    expect(parseMoney('1,250.50', 'USD').amountMinor).toBe(125050);
    expect(parseMoney('  99.99 ', 'EUR').amountMinor).toBe(9999);
  });
});

describe('allocateEqual', () => {
  it('100/3 splits deterministically and sums to original', () => {
    const out = allocateEqual(10000, 3);
    expect(out).toEqual([3334, 3333, 3333]);
    expect(sumMinor(out)).toBe(10000);
  });

  it('1/3 — remainder all to first slot', () => {
    const out = allocateEqual(1, 3);
    expect(out).toEqual([1, 0, 0]);
    expect(sumMinor(out)).toBe(1);
  });

  it('handles negative amounts', () => {
    const out = allocateEqual(-100, 3);
    expect(out).toEqual([-34, -33, -33]);
    expect(sumMinor(out)).toBe(-100);
  });

  it('zero amount returns zeros', () => {
    expect(allocateEqual(0, 5)).toEqual([0, 0, 0, 0, 0]);
  });

  it('throws on invalid n', () => {
    expect(() => allocateEqual(100, 0)).toThrow();
    expect(() => allocateEqual(100, -1)).toThrow();
    expect(() => allocateEqual(100, 1.5)).toThrow();
  });

  it('assertSumsTo throws when invariant broken', () => {
    expect(() => assertSumsTo([1, 2], 4)).toThrow();
    expect(() => assertSumsTo([1, 2], 3)).not.toThrow();
  });
});

describe('allocateByPercentage', () => {
  it('50/50 splits cleanly', () => {
    const out = allocateByPercentage(1000, [50, 50]);
    expect(out).toEqual([500, 500]);
  });

  it('33/33/34 percentages split with remainder', () => {
    const out = allocateByPercentage(100, [33, 33, 34]);
    expect(sumMinor(out)).toBe(100);
  });

  it('throws if percentages do not sum to 100', () => {
    expect(() => allocateByPercentage(100, [50, 49])).toThrow();
  });
});

describe('allocateByShares', () => {
  it('equal shares split equally', () => {
    const out = allocateByShares(300, [1, 1, 1]);
    expect(out).toEqual([100, 100, 100]);
  });

  it('weighted shares split proportionally', () => {
    const out = allocateByShares(1000, [1, 1, 1, 2]);
    expect(out).toEqual([200, 200, 200, 400]);
  });

  it('remainder distributes to highest shares first', () => {
    const out = allocateByShares(10, [1, 1, 1]);
    expect(sumMinor(out)).toBe(10);
  });

  it('throws on zero total shares', () => {
    expect(() => allocateByShares(100, [0, 0, 0])).toThrow();
  });
});
