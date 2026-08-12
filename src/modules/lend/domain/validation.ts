/**
 * Lend domain validation.
 *
 * Pure Zod schemas for Lend ledger and entry inputs. These
 * schemas are the only authoritative validators — UI form
 * code and any future server-side imports must share them.
 *
 * Domain rules enforced here:
 *   - amount must be a finite integer in minor units
 *   - amount must be non-zero (zero entries are not allowed)
 *   - for non-adjustment entries, the amount must be strictly
 *     positive (sign is supplied by the sign convention)
 *   - for adjustment entries, the amount may be negative
 *   - date must be a YYYY-MM-DD string
 *   - dueDate, when supplied, must also be YYYY-MM-DD
 *   - ledger must be a non-empty string id
 *   - personId must be a non-empty string id
 *
 * The `repayment_*` types do NOT need explicit `from` / `to`
 * Person references in V1 (Lend is always a 2-party arrangement
 * within a single (person, currency) ledger). The schemas
 * therefore intentionally do not require those fields.
 */

import { z } from 'zod';
import type { LendEntryType, LendLedger } from '@db/schema';

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD validator with reasonable calendar sanity checks. */
const dateOnly = z
  .string()
  .regex(dateOnlyRegex, 'Date must be YYYY-MM-DD')
  .refine((s) => {
    const [y, m, d] = s.split('-').map(Number);
    if (!y || !m || !d) return false;
    if (m < 1 || m > 12) return false;
    if (d < 1 || d > 31) return false;
    // Reject Feb 30, Apr 31, etc.
    const probe = new Date(y, m - 1, d);
    return (
      probe.getFullYear() === y &&
      probe.getMonth() === m - 1 &&
      probe.getDate() === d
    );
  }, 'Invalid calendar date');

/** Currency code (3-letter). Mirrors `CurrencyCode` shape but as Zod. */
const currencyCode = z
  .string()
  .min(1, 'Currency is required')
  .max(8);

/** Non-zero finite integer in minor units. */
const amountMinor = z
  .number({ invalid_type_error: 'Amount is required' })
  .int('Amount must be an integer (minor units)')
  .refine((n) => Number.isFinite(n), 'Amount must be finite')
  .refine((n) => n !== 0, 'Amount must not be zero');

const LEND_ENTRY_TYPES = [
  'lent',
  'borrowed',
  'repayment_received',
  'repayment_given',
  'adjustment',
] as const satisfies readonly LendEntryType[];

export const LendEntryTypeSchema = z.enum(LEND_ENTRY_TYPES);

export const LendLedgerInputSchema = z.object({
  personId: z.string().min(1, 'Person is required'),
  currency: currencyCode,
  label: z.string().max(120).optional().or(z.literal('')),
  archived: z.boolean().optional(),
});

export type LendLedgerInput = z.infer<typeof LendLedgerInputSchema>;

/**
 * LendEntryInput — what the UI hands to the repository.
 *
 * `amountMinor` semantics:
 *   - for non-adjustment types: always positive (magnitude)
 *   - for `adjustment`: signed (positive = they owe me,
 *     negative = I owe them)
 */
export const LendEntryInputSchema = z
  .object({
    ledgerId: z.string().min(1, 'Ledger is required'),
    type: LendEntryTypeSchema,
    amountMinor: z.number({ invalid_type_error: 'Amount is required' }),
    date: dateOnly,
    dueDate: dateOnly.optional().or(z.literal('')),
    note: z.string().max(500).optional().or(z.literal('')),
  })
  .superRefine((value, ctx) => {
    if (!Number.isFinite(value.amountMinor)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amountMinor'],
        message: 'Amount must be finite',
      });
      return;
    }
    if (value.amountMinor === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amountMinor'],
        message: 'Amount must not be zero',
      });
      return;
    }
    if (!Number.isInteger(value.amountMinor)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amountMinor'],
        message: 'Amount must be an integer (minor units)',
      });
      return;
    }
    if (value.type !== 'adjustment' && value.amountMinor < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amountMinor'],
        message: 'Amount must be positive for this entry type',
      });
    }
  });

export type LendEntryInput = z.infer<typeof LendEntryInputSchema>;

/**
 * Validate a full LendLedger entity (e.g. when reading from
 * Dexie). Mostly a sanity check for the persisted shape.
 */
export const LendLedgerSchema = z.object({
  id: z.string().min(1),
  personId: z.string().min(1),
  currency: currencyCode,
  label: z.string().max(120).optional(),
  archived: z.boolean(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  deletedAt: z.string().optional(),
  revision: z.number().int().nonnegative(),
}) satisfies z.ZodType<LendLedger>;

/**
 * Validate a full LendEntry entity.
 */
export const LendEntrySchema = z.object({
  id: z.string().min(1),
  ledgerId: z.string().min(1),
  type: LendEntryTypeSchema,
  amountMinor: z.number().int(),
  date: dateOnly,
  dueDate: dateOnly.optional(),
  note: z.string().max(500).optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  deletedAt: z.string().optional(),
  revision: z.number().int().nonnegative(),
});
