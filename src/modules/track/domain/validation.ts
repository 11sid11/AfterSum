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

/** YYYY-MM-DD date with reasonable calendar sanity. */
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
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

/** YYYY-MM month key. */
const monthKey = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM')
  .refine((s) => {
    const m = Number(s.slice(5, 7));
    return m >= 1 && m <= 12;
  }, 'Invalid month');

/** Currency code (3-letter typical, max 8 to be safe). */
const currencyCode = z
  .string()
  .min(1, 'Currency is required')
  .max(8);

/** A non-zero, finite, non-negative integer in minor units. */
const amountMinor = z
  .number({ invalid_type_error: 'Amount is required' })
  .int('Amount must be an integer (minor units)')
  .refine((n) => Number.isFinite(n), 'Amount must be finite')
  .refine((n) => n > 0, 'Amount must be greater than zero');

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
    .min(1, 'Name is required')
    .max(60, 'Name is too long')
    .transform((s) => s.trim()),
  type: TrackCategoryTypeSchema,
  icon: z.string().max(40).optional().or(z.literal('')),
  archived: z.boolean().optional(),
});

export type TrackCategoryInput = z.infer<typeof TrackCategoryInputSchema>;

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
    .min(1, 'Title is required')
    .max(120, 'Title is too long')
    .transform((s) => s.trim()),
  amountMinor,
  currency: currencyCode,
  categoryId: z.string().min(1).optional().or(z.literal('')),
  paymentMethod: PaymentMethodSchema.optional(),
  date: dateOnly,
  note: z.string().max(500).optional().or(z.literal('')),
});

export type TrackTransactionInput = z.infer<typeof TrackTransactionInputSchema>;

/** Clean an input by stripping empties to `undefined`. */
export function cleanTransactionInput(input: TrackTransactionInput): TrackTransactionInput {
  return {
    ...input,
    categoryId: input.categoryId || undefined,
    paymentMethod: input.paymentMethod || undefined,
    note: input.note || undefined,
  };
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
    .min(1, 'Title is required')
    .max(120, 'Title is too long')
    .transform((s) => s.trim()),
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
    ...input,
    enabled: input.enabled ?? true,
    amountMinor: input.amountMinor,
    categoryId: input.categoryId || undefined,
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
