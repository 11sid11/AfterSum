/**
 * settle service.
 *
 * Record a Split settlement: "person A paid person B ₹X
 * inside group G". Affects only the Split group balance
 * formula (`+sent -received`).
 *
 * Module independence: this never touches Lend or Track.
 * If a user wants to record the same money in their Lend
 * ledger, they must do that explicitly in the Lend module.
 */

import { splitSettlementRepository } from '../repositories/splitSettlementRepository';
import type { SplitSettlementInput } from '../domain/validation';
import type { SplitSettlement } from '@db/schema';

export type RecordSettlementInput = SplitSettlementInput;

export async function recordSettlement(input: RecordSettlementInput): Promise<SplitSettlement> {
  return splitSettlementRepository.create(input);
}
