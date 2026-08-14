/**
 * Split domain validation.
 *
 * Pure Zod schemas for the Split module. These schemas are the authoritative
 * validators used by UI and persistence services.
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
    return probe.getFullYear() === y && probe.getMonth() === m - 1 && probe.getDate() === d;
  }, 'Invalid calendar date');

const currencyCode = z.string().min(1, 'Currency is required').max(8);

const positiveAmountMinor = z
  .number({ invalid_type_error: 'Amount is required' })
  .int('Amount must be an integer (minor units)')
  .refine((n) => Number.isFinite(n), 'Amount must be finite')
  .refine((n) => n > 0, 'Amount must be greater than zero');

const personId = z.string().min(1, 'Person id is required');

export const SPLIT_METHODS = ['equal', 'exact', 'percentage', 'shares'] as const satisfies readonly SplitMethod[];
export const SplitMethodSchema = z.enum(SPLIT_METHODS);

export const SPLIT_EXPENSE_CATEGORIES = [
  'food',
  'stay',
  'travel',
  'fun',
  'shopping',
  'other',
] as const;
export const SplitExpenseCategorySchema = z.enum(SPLIT_EXPENSE_CATEGORIES);

export const SplitAllocationSnapshotSchema = z.object({
  exactAmountsByPersonId: z.record(personId, positiveAmountMinor).optional(),
  percentagesByPersonId: z.record(personId, z.number().min(0).max(100)).optional(),
  sharesByPersonId: z.record(personId, z.number().int().positive()).optional(),
});

export const SplitDefaultSplitSchema = z.object({
  payerPersonId: personId.optional(),
  participantIds: z.array(personId).min(1),
  splitMethod: z.enum(['equal', 'percentage', 'shares']),
  allocation: SplitAllocationSnapshotSchema.optional(),
});

export const SplitItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, 'Item name is required').max(120),
  amountMinor: positiveAmountMinor,
  participantIds: z.array(personId).min(1, 'Choose at least one person for every item'),
});

export const SplitRecurringTemplateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  amountMinor: positiveAmountMinor,
  category: SplitExpenseCategorySchema.optional(),
  payerPersonId: personId,
  participantIds: z.array(personId).min(1),
  splitMethod: SplitMethodSchema,
  allocation: SplitAllocationSnapshotSchema.optional(),
  note: z.string().max(1000).optional().or(z.literal('')),
  frequency: z.enum(['weekly', 'monthly', 'yearly']),
  anchorDate: dateOnly,
  nextDate: dateOnly,
  enabled: z.boolean(),
  originalCurrency: currencyCode.optional(),
  originalAmountMinor: positiveAmountMinor.optional(),
  exchangeRate: z.number().positive().finite().optional(),
  items: z.array(SplitItemSchema).optional(),
});

// ---------------------------------------------------------------------------
// Group
// ---------------------------------------------------------------------------

export const SplitGroupInputSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(120, 'Group name is too long'),
  description: z.string().max(500).optional().or(z.literal('')),
  currency: currencyCode,
  archived: z.boolean().optional(),
  defaultSplit: SplitDefaultSplitSchema.optional(),
  recurringTemplates: z.array(SplitRecurringTemplateSchema).optional(),
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

const SplitExpenseBaseSchema = z.object({
  groupId: personId,
  title: z.string().min(1, 'Title is required').max(200),
  amountMinor: positiveAmountMinor,
  currency: currencyCode,
  date: dateOnly,
  splitMethod: SplitMethodSchema,
  category: SplitExpenseCategorySchema.optional(),
  note: z.string().max(1000).optional().or(z.literal('')),
  originalCurrency: currencyCode.optional(),
  originalAmountMinor: positiveAmountMinor.optional(),
  exchangeRate: z.number().positive().finite().optional(),
  items: z.array(SplitItemSchema).optional(),
  recurrenceTemplateId: z.string().min(1).optional(),
  recurrenceOccurrenceDate: dateOnly.optional(),
  importSourceKey: z.string().min(1).max(160).optional(),
});

export const SplitPayerInputSchema = z.object({
  personId,
  amountMinor: positiveAmountMinor,
});

export type SplitPayerInput = z.infer<typeof SplitPayerInputSchema>;

export const SplitShareInputSchema = z.object({
  personId,
  amountMinor: z
    .number({ invalid_type_error: 'Share amount is required' })
    .int('Share amount must be an integer (minor units)')
    .refine((n) => Number.isFinite(n), 'Share amount must be finite')
    .refine((n) => n > 0, 'Share amount must be greater than zero'),
});

export type SplitShareInput = z.infer<typeof SplitShareInputSchema>;

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

export const SplitExpenseInputSchema = SplitExpenseBaseSchema.extend({
  payers: z.array(SplitPayerInputSchema).min(1, 'At least one payer is required'),
  participantIds: z.array(personId).min(1, 'At least one participant is required'),
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
// Cross-field invariants
// ---------------------------------------------------------------------------

export function assertExpenseInvariants(input: {
  amountMinor: number;
  payers: Array<{ personId: string; amountMinor: number }>;
  shares: Array<{ personId: string; amountMinor: number }>;
  splitMethod: SplitMethod;
  allocation?: SplitAllocationInput;
}): void {
  if (input.payers.length === 0) throw new Error('At least one payer is required');
  if (input.shares.length === 0) throw new Error('At least one participant is required');

  const payerTotal = input.payers.reduce((a, b) => a + b.amountMinor, 0);
  if (payerTotal !== input.amountMinor) {
    throw new Error(`Payer totals (${payerTotal}) do not match expense amount (${input.amountMinor})`);
  }

  const shareTotal = input.shares.reduce((a, b) => a + b.amountMinor, 0);
  if (shareTotal !== input.amountMinor) {
    throw new Error(`Share totals (${shareTotal}) do not match expense amount (${input.amountMinor})`);
  }

  if (input.splitMethod === 'percentage' && input.allocation?.method === 'percentage') {
    const total = Object.values(input.allocation.percentagesByPersonId).reduce(
      (sum: number, value: number) => sum + value,
      0,
    );
    if (Math.abs(total - 100) > 0.0001) {
      throw new Error(`Percentages must sum to 100 (got ${total})`);
    }
  }
}

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
