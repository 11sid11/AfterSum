/**
 * Debt simplification.
 *
 * Given a per-person balance map (positive = should receive,
 * negative = owes), returns a minimal-ish list of transfers
 * that, when applied, would zero out the balances.
 *
 * Per the spec (work.md §38), debt simplification must
 * return RECOMMENDATIONS only. The expense / settlement
 * tables must NOT be mutated. This function is pure.
 *
 * Algorithm: greedy. While at least one positive and one
 * negative balance remain, transfer the minimum of the
 * largest absolute positive and the largest absolute negative
 * from the negative to the positive. This is not provably
 * minimal in transfer count (the optimal version is NP-hard
 * via subset sum), but it matches the spec's worked example
 * and is what users intuitively expect.
 *
 * Spec example:
 *   Sid    +4000
 *   Rahul  -2000
 *   Aman   -2000
 * -> Rahul -> Sid 2000
 *    Aman  -> Sid 2000
 */
import type { BalanceMap } from './balances';

export interface Transfer {
  fromPersonId: string;
  toPersonId: string;
  amountMinor: number;
}

export function simplifyDebts(balances: BalanceMap): Transfer[] {
  // Work on shallow copies so the caller's map is never
  // mutated. The spec is explicit about this.
  const working = new Map<string, number>();
  for (const [k, v] of balances) {
    if (v !== 0) working.set(k, v);
  }

  const transfers: Transfer[] = [];

  while (working.size > 0) {
    // Find the largest creditor (positive) and the largest
    // debtor (most negative).
    let creditorId: string | null = null;
    let creditorAmt = 0;
    let debtorId: string | null = null;
    let debtorAmt = 0;
    for (const [pid, amt] of working) {
      if (amt > creditorAmt) {
        creditorAmt = amt;
        creditorId = pid;
      }
      if (amt < debtorAmt) {
        debtorAmt = amt;
        debtorId = pid;
      }
    }
    if (!creditorId || !debtorId) break;

    const amount = Math.min(creditorAmt, -debtorAmt);
    transfers.push({
      fromPersonId: debtorId,
      toPersonId: creditorId,
      amountMinor: amount,
    });

    const newCreditor = creditorAmt - amount;
    const newDebtor = debtorAmt + amount; // debtorAmt is negative
    if (newCreditor === 0) working.delete(creditorId);
    else working.set(creditorId, newCreditor);
    if (newDebtor === 0) working.delete(debtorId);
    else working.set(debtorId, newDebtor);
  }

  return transfers;
}
