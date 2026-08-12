/**
 * Split domain validation.
 *
 * Pure Zod schemas for the Split module. These schemas are the
 * authoritative validators — UI forms and any future server-side
 * import must share them.
 *
 * Domain rules enforced here:
 *   - title is required
 *   - amount must be a positive integer in minor units
 *   - date must be a YYYY-MM-DD string
 *   - currency must be a non-empty string
 *   - for an expense: at least 1 participant, at least 1 payer
 *   - for an expense: payer totals must equal expense total
 *   - for an expense: share totals must equal expense total
 *   - for percentage splits: percentage total must equal 100
 *   - for shares splits: every share value must be > 0
 *   - settlements: amount > 0, from and to must be different
 *
 * Module independence: Split is independent from Track and Lend.
 * Person references are just opaque ids; the Split module never
 * reads or writes Track / Lend rows.
 */

import { z } from 'zod';
import type { SplitMethod } from '@db/schema';

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

const dateOnly = z
  .string()
  .regex(dateOnlyRegex, 'Date must be YYYY-MM-DD')
  .refine((s) => {
    const [y, m, d] = s.split('-').map(Number);
    if (!y || !m || !d) return false;
    if (m < 1 || m > 12) return false;
    if (d < 1 || d > 31) return false;
    const probe = new Date(y, m - 1, d);
    return (
      probe.getFullYear() === y &&
      probe.getMonth() === m - 1 &&
      probe.getDate() === d
    );
  }, 'Invalid calendar date');

const currencyCode = z
  .string()
  .min(1, 'Currency is required')
  .max(8);

/** Positive finite integer in minor units. Zero amounts are not allowed. */
const positiveAmountMinor = z
  .number({ invalid_type_error: 'Amount is required' })
  .int('Amount must be an integer (minor units)')
  .refine((n) => Number.isFinite(n), 'Amount must be finite')
  .refine((n) => n > 0, 'Amount must be greater than zero');

const personId = z.string().min(1, 'Person id is required');

// ---------------------------------------------------------------------------
// Group
// ---------------------------------------------------------------------------

export const SplitGroupInputSchema = z.object({
  name: z
    .string()
    .min(1, 'Group name is required')
    .max(120, 'Group name is too long'),
  description: z.string().max(500).optional().or(z.literal('')),
  currency: currencyCode,
  archived: z.boolean().optional(),
});

export type SplitGroupInput = z.infer<typeof SplitGroupInputSchema>;

export const SplitGroupUpdateSchema = SplitGroupInputSchema.partial();
export type SplitGroupUpdate = z.infer<typeof SplitGroupUpdateSchema>;

// ---------------------------------------------------------------------------
// Member
// ---------------------------------------------------------------------------

export const SplitGroupMemberInputSchema = z.object({
  groupId: personId,
  personId,
  active: z.boolean().optional(),
});

export type SplitGroupMemberInput = z.infer<typeof SplitGroupMemberInputSchema>;

// ---------------------------------------------------------------------------
// Expense
// ---------------------------------------------------------------------------

export const SPLIT_METHODS = [
  'equal',
  'exact',
  'percentage',
  'shares',
] as const satisfies readonly SplitMethod[];

export const SplitMethodSchema = z.enum(SPLIT_METHODS);

const SplitExpenseBaseSchema = z.object({
  groupId: personId,
  title: z.string().min(1, 'Title is required').max(200),
  amountMinor: positiveAmountMinor,
  currency: currencyCode,
  date: dateOnly,
  splitMethod: SplitMethodSchema,
  note: z.string().max(1000).optional().or(z.literal('')),
});

/** A single payer contribution for an expense. */
export const SplitPayerInputSchema = z.object({
  personId,
  amountMinor: positiveAmountMinor,
});

export type SplitPayerInput = z.infer<typeof SplitPayerInputSchema>;

/** A single participant allocation (final monetary share). */
export const SplitShareInputSchema = z.object({
  personId,
  amountMinor: z
    .number({ invalid_type_error: 'Share amount is required' })
    .int('Share amount must be an integer (minor units)')
    .refine((n) => Number.isFinite(n), 'Share amount must be finite')
    .refine((n) => n > 0, 'Share amount must be greater than zero'),
});

export type SplitShareInput = z.infer<typeof SplitShareInputSchema>;

/** User-entered per-method allocation values used to compute shares. */
export const SplitAllocationInputSchema = z.union([
  z.object({ method: z.literal('equal') }),
  z.object({
    method: z.literal('exact'),
    amountsByPersonId: z.record(personId, positiveAmountMinor),
  }),
  z.object({
    method: z.literal('percentage'),
    percentagesByPersonId: z.record(
      personId,
      z.number().min(0, 'Percentage must be >= 0').max(100, 'Percentage must be <= 100'),
    ),
  }),
  z.object({
    method: z.literal('shares'),
    sharesByPersonId: z.record(
      personId,
      z.number().int('Shares must be an integer').positive('Shares must be > 0'),
    ),
  }),
]);

export type SplitAllocationInput = z.infer<typeof SplitAllocationInputSchema>;

/**
 * Full expense input from a form. The service layer is
 * responsible for computing the actual per-person share
 * amounts and re-validating the totals.
 */
export const SplitExpenseInputSchema = SplitExpenseBaseSchema.extend({
  payers: z.array(SplitPayerInputSchema).min(1, 'At least one payer is required'),
  participantIds: z
    .array(personId)
    .min(1, 'At least one participant is required'),
  allocation: SplitAllocationInputSchema,
});

export type SplitExpenseInput = z.infer<typeof SplitExpenseInputSchema>;

// ---------------------------------------------------------------------------
// Settlement
// ---------------------------------------------------------------------------

export const SplitSettlementInputSchema = z.object({
  groupId: personId,
  fromPersonId: personId,
  toPersonId: personId,
  amountMinor: positiveAmountMinor,
  currency: currencyCode,
  date: dateOnly,
  note: z.string().max(500).optional().or(z.literal('')),
});

export type SplitSettlementInput = z.infer<typeof SplitSettlementInputSchema>;

// ---------------------------------------------------------------------------
// Helpers (cross-field, not pure Zod)
// ---------------------------------------------------------------------------

/**
 * Cross-field validation for an expense. The pure Zod schema
 * cannot easily check "shares sum to total" without coupling
 * to money utilities, so we expose this as a separate function
 * used by the service layer.
 *
 * Throws on any inconsistency.
 */
export function assertExpenseInvariants(input: {
  amountMinor: number;
  payers: Array<{ personId: string; amountMinor: number }>;
  shares: Array<{ personId: string; amountMinor: number }>;
  splitMethod: SplitMethod;
  allocation?: SplitAllocationInput;
}): void {
  if (input.payers.length === 0) {
    throw new Error('At least one payer is required');
  }
  if (input.shares.length === 0) {
    throw new Error('At least one participant is required');
  }
  const payerTotal = input.payers.reduce((a, b) => a + b.amountMinor, 0);
  if (payerTotal !== input.amountMinor) {
    throw new Error(
      `Payer totals (${payerTotal}) do not match expense amount (${input.amountMinor})`,
    );
  }
  const shareTotal = input.shares.reduce((a, b) => a + b.amountMinor, 0);
  if (shareTotal !== input.amountMinor) {
    throw new Error(
      `Share totals (${shareTotal}) do not match expense amount (${input.amountMinor})`,
    );
  }
  if (input.splitMethod === 'percentage' && input.allocation) {
    const allocation = input.allocation;
    if (allocation.method === 'percentage') {
      const totals = Object.values(allocation.percentagesByPersonId).reduce(
        (a: number, b: number) => a + b,
        0,
      );
      if (Math.abs(totals - 100) > 0.0001) {
        throw new Error(`Percentages must sum to 100 (got ${totals})`);
      }
    }
  }
}

/** Cross-field validation for a settlement. */
export function assertSettlementInvariants(input: {
  fromPersonId: string;
  toPersonId: string;
  amountMinor: number;
}): void {
  if (input.fromPersonId === input.toPersonId) {
    throw new Error('Settlement from and to must be different people');
  }
  if (input.amountMinor <= 0) {
    throw new Error('Settlement amount must be greater than zero');
  }
}
