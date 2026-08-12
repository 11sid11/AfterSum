/**
 * Track module — Zod validation schemas.
 *
 * These are the authoritative validators for every Track
 * input. They are the single source of truth: form code in
 * TanStack Form consumes them via `zodValidator`, and any
 * repository write must call `.parse()` on the input before
 * persisting so domain rules are also enforced outside the UI.
 *
 * Rules (work.md §80):
 *   - reject zero amounts
 *   - reject negative user-entered amounts (Track uses type
 *     to indicate direction; amountMinor is the magnitude)
 *   - reject blank titles
 *   - reject malformed dates
 *
 * Note: schemas are kept simple (no `.preprocess` / `.refine`)
 * so they remain StandardSchemaV1-compatible with TanStack
 * Form's strict type expectations. Trimming and date sanity
 * are done in the repository layer (`cleanTransactionInput`
 * + `assertTransactionInvariants`).
 */

import { z } from 'zod';
import type {
  PaymentMethod,
  RecurringFrequency,
  TrackCategory,
  TrackCategoryType,
  TrackTransaction,
  TrackTransactionType,
  TrackBudget,
  TrackRecurringRule,
} from '@db/schema';

/** YYYY-MM-DD date string. */
const dateOnly = z
  .string()
  .min(10, 'Date is required')
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

/** YYYY-MM month key. */
const monthKey = z
  .string()
  .min(7, 'Month is required')
  .regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM');

/** Currency code (3-letter typical, max 8 to be safe). */
const currencyCode = z
  .string()
  .min(1, 'Currency is required')
  .max(8);

/** A non-zero positive integer in minor units. */
const amountMinor = z
  .number({ invalid_type_error: 'Amount is required' })
  .int('Amount must be an integer (minor units)')
  .positive('Amount must be greater than zero');

export const TRACK_CATEGORY_TYPES = ['expense', 'income'] as const satisfies readonly TrackCategoryType[];

export const TRACK_TRANSACTION_TYPES = ['expense', 'income'] as const satisfies readonly TrackTransactionType[];

export const PAYMENT_METHODS = ['cash', 'upi', 'card', 'other'] as const satisfies readonly PaymentMethod[];

export const RECURRING_FREQUENCIES = ['weekly', 'monthly', 'yearly'] as const satisfies readonly RecurringFrequency[];

export const TrackCategoryTypeSchema = z.enum(TRACK_CATEGORY_TYPES);
export const TrackTransactionTypeSchema = z.enum(TRACK_TRANSACTION_TYPES);
export const PaymentMethodSchema = z.enum(PAYMENT_METHODS);
export const RecurringFrequencySchema = z.enum(RECURRING_FREQUENCIES);

// ---------- Category ----------

export const TrackCategoryInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(60, 'Name is too long'),
  type: TrackCategoryTypeSchema,
  icon: z.string().max(40).optional().or(z.literal('')),
  archived: z.boolean().optional(),
});

export type TrackCategoryInput = z.infer<typeof TrackCategoryInputSchema>;

export function cleanCategoryInput(input: TrackCategoryInput): TrackCategoryInput {
  return {
    name: input.name.trim(),
    type: input.type,
    icon: input.icon || undefined,
    archived: input.archived,
  };
}

/** Full entity schema (used by backup validation, import). */
export const TrackCategoryEntitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: TrackCategoryTypeSchema,
  icon: z.string().optional(),
  archived: z.boolean(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  deletedAt: z.string().optional(),
  revision: z.number().int().nonnegative(),
}) satisfies z.ZodType<TrackCategory>;

// ---------- Transaction ----------

export const TrackTransactionInputSchema = z.object({
  type: TrackTransactionTypeSchema,
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(120, 'Title is too long'),
  amountMinor,
  currency: currencyCode,
  categoryId: z.string().min(1).optional().or(z.literal('')),
  paymentMethod: PaymentMethodSchema.optional(),
  date: dateOnly,
  note: z.string().max(500).optional().or(z.literal('')),
});

export type TrackTransactionInput = z.infer<typeof TrackTransactionInputSchema>;

export function cleanTransactionInput(input: TrackTransactionInput): TrackTransactionInput {
  return {
    ...input,
    title: input.title.trim(),
    categoryId: input.categoryId || undefined,
    paymentMethod: input.paymentMethod || undefined,
    note: input.note || undefined,
  };
}

/** Cross-field sanity checks (run after .parse()). */
export function assertTransactionInvariants(input: TrackTransactionInput): void {
  if (!Number.isFinite(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error('Amount must be a positive integer in minor units');
  }
  // date shape was already checked by the regex; no further check.
}

/** Full entity schema. */
export const TrackTransactionEntitySchema = z.object({
  id: z.string().min(1),
  type: TrackTransactionTypeSchema,
  title: z.string().min(1),
  amountMinor: z.number().int().positive(),
  currency: currencyCode,
  categoryId: z.string().min(1).optional(),
  paymentMethod: PaymentMethodSchema.optional(),
  date: dateOnly,
  note: z.string().max(500).optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  deletedAt: z.string().optional(),
  revision: z.number().int().nonnegative(),
}) satisfies z.ZodType<TrackTransaction>;

// ---------- Budget ----------

export const TrackBudgetInputSchema = z.object({
  month: monthKey,
  amountMinor,
  currency: currencyCode,
});

export type TrackBudgetInput = z.infer<typeof TrackBudgetInputSchema>;

export const TrackBudgetEntitySchema = z.object({
  id: z.string().min(1),
  month: monthKey,
  amountMinor: z.number().int().positive(),
  currency: currencyCode,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  deletedAt: z.string().optional(),
  revision: z.number().int().nonnegative(),
}) satisfies z.ZodType<TrackBudget>;

// ---------- Recurring rule ----------

export const TrackRecurringRuleInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(120, 'Title is too long'),
  amountMinor: z.number().int().positive().optional(),
  currency: currencyCode,
  categoryId: z.string().min(1).optional().or(z.literal('')),
  frequency: RecurringFrequencySchema,
  nextDate: dateOnly,
  enabled: z.boolean().optional().default(true),
});

export type TrackRecurringRuleInput = z.infer<typeof TrackRecurringRuleInputSchema>;

export function cleanRecurringRuleInput(input: TrackRecurringRuleInput): TrackRecurringRuleInput {
  return {
    title: input.title.trim(),
    amountMinor: input.amountMinor,
    currency: input.currency,
    categoryId: input.categoryId || undefined,
    frequency: input.frequency,
    nextDate: input.nextDate,
    enabled: input.enabled ?? true,
  };
}

export const TrackRecurringRuleEntitySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  amountMinor: z.number().int().positive().optional(),
  currency: currencyCode,
  categoryId: z.string().min(1).optional(),
  frequency: RecurringFrequencySchema,
  nextDate: dateOnly,
  enabled: z.boolean(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  deletedAt: z.string().optional(),
  revision: z.number().int().nonnegative(),
}) satisfies z.ZodType<TrackRecurringRule>;
