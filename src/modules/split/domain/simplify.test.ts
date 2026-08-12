/**
 * Debt simplification tests.
 *
 * Spec example (§38):
 *   Sid    +4000
 *   Rahul  -2000
 *   Aman   -2000
 * -> Rahul -> Sid 2000
 *    Aman  -> Sid 2000
 */

import { describe, it, expect } from 'vitest';
import { simplifyDebts } from './simplify';

describe('simplifyDebts', () => {
  it('spec example: Sid +4000, Rahul -2000, Aman -2000 → 2 transfers', () => {
    const balances = new Map<string, number>([
      ['sid', 4000],
      ['rahul', -2000],
      ['aman', -2000],
    ]);
    const out = simplifyDebts(balances);
    expect(out).toHaveLength(2);
    const sums = out.reduce((s, t) => s + t.amountMinor, 0);
    expect(sums).toBe(4000);
    expect(out).toEqual(
      expect.arrayContaining([
        { fromPersonId: 'rahul', toPersonId: 'sid', amountMinor: 2000 },
        { fromPersonId: 'aman', toPersonId: 'sid', amountMinor: 2000 },
      ]),
    );
  });

  it('all settled returns empty array', () => {
    const balances = new Map<string, number>([
      ['a', 0],
      ['b', 0],
    ]);
    expect(simplifyDebts(balances)).toEqual([]);
  });

  it('single creditor / single debtor is one transfer', () => {
    const balances = new Map<string, number>([
      ['a', 1000],
      ['b', -1000],
    ]);
    const out = simplifyDebts(balances);
    expect(out).toEqual([{ fromPersonId: 'b', toPersonId: 'a', amountMinor: 1000 }]);
  });

  it('partial settle reduces the transfer amount', () => {
    const balances = new Map<string, number>([
      ['a', 500],
      ['b', -1000],
    ]);
    const out = simplifyDebts(balances);
    expect(out).toEqual([{ fromPersonId: 'b', toPersonId: 'a', amountMinor: 500 }]);
  });

  it('does not mutate the input map', () => {
    const balances = new Map<string, number>([
      ['a', 4000],
      ['b', -2000],
      ['c', -2000],
    ]);
    const snapshot = new Map(balances);
    simplifyDebts(balances);
    expect(balances).toEqual(snapshot);
  });

  it('four-person case distributes across the largest creditor', () => {
    const balances = new Map<string, number>([
      ['a', 5000],
      ['b', 3000],
      ['c', -4000],
      ['d', -4000],
    ]);
    const out = simplifyDebts(balances);
    // c -> a 4000, d -> a 1000, d -> b 3000 = 8000 moved
    const total = out.reduce((s, t) => s + t.amountMinor, 0);
    expect(total).toBe(8000);
    expect(out.length).toBeLessThanOrEqual(3);
  });

  it('does not produce any zero-amount transfers', () => {
    const balances = new Map<string, number>([
      ['a', 0],
      ['b', 0],
    ]);
    expect(simplifyDebts(balances).every((t) => t.amountMinor > 0)).toBe(true);
  });
});
