/**
 * Lend sign convention tests.
 *
 * The spec (work.md §24, §84) REQUIRES the test case:
 *
 *   lend ₹5,000        -> +5,000
 *   repayment ₹2,000   -> -2,000
 *   lend ₹1,000        -> +1,000
 *   net                -> +4,000   (they owe me 4,000)
 *
 * This is a permanent regression test.
 *
 * Also tested: the alternative scenario in §84 of the
 * spec: borrow 5,000 + repay 2,000 -> -3,000.
 */

import { describe, it, expect } from 'vitest';
import {
  ENTRY_TYPE_SIGN,
  entryToSignedAmount,
  magnitudeToStoredAmount,
} from './signs';
import type { LendEntry, LendEntryType } from '@db/schema';

function makeEntry(type: LendEntryType, amountMinor: number): LendEntry {
  return {
    id: `e-${Math.random().toString(36).slice(2, 8)}`,
    ledgerId: 'ledger-1',
    type,
    amountMinor,
    date: '2024-01-01',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    revision: 1,
  };
}

describe('Lend sign convention', () => {
  it('has the canonical sign per type', () => {
    expect(ENTRY_TYPE_SIGN.lent).toBe(1);
    expect(ENTRY_TYPE_SIGN.borrowed).toBe(-1);
    expect(ENTRY_TYPE_SIGN.repayment_received).toBe(-1);
    expect(ENTRY_TYPE_SIGN.repayment_given).toBe(1);
  });

  it('lent 5,000 + repayment_received 2,000 + lent 1,000 -> +4,000 (they owe me 4,000)', () => {
    const a = makeEntry('lent', 500000);
    const b = makeEntry('repayment_received', 200000);
    const c = makeEntry('lent', 100000);
    const signed = [a, b, c].map(entryToSignedAmount);
    expect(signed).toEqual([500000, -200000, 100000]);
    const balance = signed.reduce((acc, v) => acc + v, 0);
    expect(balance).toBe(400000);
  });

  it('borrowed 5,000 + repayment_given 2,000 -> -3,000 (I owe them 3,000)', () => {
    const a = makeEntry('borrowed', 500000);
    const b = makeEntry('repayment_given', 200000);
    const balance = [a, b].map(entryToSignedAmount).reduce((acc, v) => acc + v, 0);
    expect(balance).toBe(-300000);
  });

  it('adjustment is treated as user-supplied signed amount', () => {
    const positive = makeEntry('adjustment', 2500);
    const negative = makeEntry('adjustment', -2500);
    expect(entryToSignedAmount(positive)).toBe(2500);
    expect(entryToSignedAmount(negative)).toBe(-2500);
  });

  it('repayment_received offsets lent; repayment_given offsets borrowed', () => {
    // Person lent 1000, then repaid 300 -> they owe 700.
    const lent = makeEntry('lent', 100000);
    const repaid = makeEntry('repayment_received', 30000);
    expect(entryToSignedAmount(lent) + entryToSignedAmount(repaid)).toBe(70000);
    // Person borrowed 1000, then gave back 300 -> I owe 700.
    const borrowed = makeEntry('borrowed', 100000);
    const gave = makeEntry('repayment_given', 30000);
    expect(entryToSignedAmount(borrowed) + entryToSignedAmount(gave)).toBe(-70000);
  });

  it('magnitudeToStoredAmount preserves the magnitude for non-adjustment types', () => {
    expect(magnitudeToStoredAmount('lent', 5000)).toBe(5000);
    expect(magnitudeToStoredAmount('borrowed', 5000)).toBe(5000);
    expect(magnitudeToStoredAmount('repayment_received', 5000)).toBe(5000);
    expect(magnitudeToStoredAmount('repayment_given', 5000)).toBe(5000);
  });

  it('magnitudeToStoredAmount preserves sign for adjustment', () => {
    expect(magnitudeToStoredAmount('adjustment', 5000)).toBe(5000);
    expect(magnitudeToStoredAmount('adjustment', -5000)).toBe(-5000);
  });
});
