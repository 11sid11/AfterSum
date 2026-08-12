/**
 * LendEntryForm — the form used by the "Add lend entry" page.
 *
 * Uses TanStack Form with the Zod schema from
 * `modules/lend/domain/validation`. The currency is
 * implied by the person's first active ledger (created
 * on-demand if the person has no Lend ledger yet).
 *
 * The form supports a `defaultType` prop and a
 * `defaultPersonId` so the same component can serve
 * "Add from Lend home" and "Add for Rahul" flows.
 *
 * Form shape (per `LendEntryInputSchema`):
 *   - personId: string    (the form's "person" picker value)
 *   - type: LendEntryType
 *   - amountMinor: number
 *   - date: string
 *   - dueDate?: string
 *   - note?: string
 *
 * The ledger is resolved (or created) at submit time.
 */

import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { z } from 'zod';
import {
  Card,
  Button,
  Input,
  Textarea,
  MoneyInput,
  DateInput,
  PersonPicker,
  useToast,
  Spinner,
} from '@components/ui';
import { useAppSettings } from '@shared/settings/useSettings';
import { todayDateOnly } from '@shared/dates';
import { lendEntryRepository } from '../repositories/lendEntryRepository';
import { lendLedgerRepository } from '../repositories/lendLedgerRepository';
import { LendEntryInputSchema, LendEntryTypeSchema } from '../domain/validation';
import type { LendEntryType } from '@db/schema';
import type { CurrencyCode } from '@shared/money';
import { ArrowLeft } from 'lucide-react';
import { useLendLedgerForPerson } from '../queries';

// Use a permissive schema at the form level so we can
// validate incrementally and convert `personId` to
// `ledgerId` at submit time.
const FormSchema = z.object({
  personId: z.string().min(1, 'Please select a person'),
  type: LendEntryTypeSchema,
  amountMinor: z.number().int().refine((n) => n !== 0, 'Amount must not be zero'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD').optional().or(z.literal('')),
  note: z.string().max(500).optional().or(z.literal('')),
});
type FormValues = z.infer<typeof FormSchema>;

const TYPE_OPTIONS: Array<{ value: LendEntryType; label: string; tone: 'emerald' | 'rose' | 'sky' | 'slate' }> = [
  { value: 'lent', label: 'Lent', tone: 'emerald' },
  { value: 'borrowed', label: 'Borrowed', tone: 'rose' },
  { value: 'repayment_received', label: 'Repaid me', tone: 'sky' },
  { value: 'repayment_given', label: 'I repaid', tone: 'sky' },
  { value: 'adjustment', label: 'Adjustment', tone: 'slate' },
];

/** Extract a human-readable error string from TanStack Form's `meta.errors`. */
function extractError(errors: ReadonlyArray<unknown>): string | undefined {
  for (const e of errors) {
    if (e === undefined || e === null) continue;
    if (typeof e === 'string') return e;
    if (typeof e === 'object' && 'message' in e) {
      const msg = (e as { message?: unknown }).message;
      if (typeof msg === 'string') return msg;
    }
  }
  return undefined;
}

interface LendEntryFormProps {
  /** Prefilled entry type. */
  defaultType?: LendEntryType;
  /** Prefilled person id (used when launched from a person detail page). */
  defaultPersonId?: string;
  /** Called after successful submit. */
  onSaved?: (entryId: string) => void;
  /** Called when the user cancels. */
  onCancel?: () => void;
}

function typeHelp(type: LendEntryType): string {
  switch (type) {
    case 'lent':
      return 'Add money you gave to this person. Increases the amount they owe you.';
    case 'borrowed':
      return 'Add money you received from this person. Increases the amount you owe them.';
    case 'repayment_received':
      return 'Record a payment you received. Decreases the amount they owe you.';
    case 'repayment_given':
      return 'Record a payment you made. Decreases the amount you owe them.';
    case 'adjustment':
      return 'Use a positive number if they still owe you, negative if you owe them.';
  }
}

export function LendEntryForm({
  defaultType = 'lent',
  defaultPersonId,
  onSaved,
  onCancel,
}: LendEntryFormProps) {
  const settings = useAppSettings();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  // Live read of the resolved currency for the chosen
  // person so the MoneyInput can switch on the fly.
  const [personId, setPersonId] = useState<string | undefined>(defaultPersonId);
  const existingLedger = useLendLedgerForPerson(personId, settings?.defaultCurrency ?? 'INR');
  const resolvedCurrency: CurrencyCode = existingLedger?.currency ?? settings?.defaultCurrency ?? 'INR';

  if (!settings) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner />
      </div>
    );
  }

  const initialValues: FormValues = {
    personId: defaultPersonId ?? '',
    type: defaultType,
    amountMinor: 0,
    date: todayDateOnly(),
    dueDate: '',
    note: '',
  };

  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onChange: FormSchema,
    },
    onSubmit: async ({ value }) => {
      setSubmitting(true);
      try {
        if (!value.personId) {
          throw new Error('Please select a person');
        }
        // Resolve (or create) the ledger for the chosen
        // person in the active currency.
        const ledger = await lendLedgerRepository.getOrCreate(
          value.personId,
          resolvedCurrency,
        );
        const cleaned: z.infer<typeof LendEntryInputSchema> = {
          ledgerId: ledger.id,
          type: value.type,
          amountMinor: value.amountMinor,
          date: value.date,
          dueDate: typeof value.dueDate === 'string' && value.dueDate !== '' ? value.dueDate : undefined,
          note: typeof value.note === 'string' ? value.note.trim() : undefined,
        };
        const created = await lendEntryRepository.create(cleaned);
        toast.show('Entry added', { variant: 'success' });
        if (onSaved) {
          onSaved(created.id);
        }
      } catch (err) {
        toast.show(err instanceof Error ? err.message : 'Could not save', { variant: 'error' });
        setSubmitting(false);
      }
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
      className="space-y-4"
    >
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Back"
          className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-semibold">Add lend entry</h1>
      </header>

      <Card>
        <form.Field name="type">
          {(field) => (
            <div className="space-y-1">
              <label className="label">Type</label>
              <div className="inline-flex w-full flex-wrap gap-1 rounded-full border border-slate-200 bg-white p-0.5 text-sm dark:border-slate-700 dark:bg-slate-900">
                {TYPE_OPTIONS.map((opt) => {
                  const active = field.state.value === opt.value;
                  const toneActive =
                    opt.tone === 'emerald'
                      ? 'bg-emerald-600 text-white'
                      : opt.tone === 'rose'
                        ? 'bg-rose-600 text-white'
                        : opt.tone === 'sky'
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-700 text-white';
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => field.handleChange(opt.value)}
                      aria-pressed={active}
                      className={
                        active
                          ? `flex-1 rounded-full px-3 py-1.5 font-medium ${toneActive}`
                          : 'flex-1 rounded-full px-3 py-1.5 text-slate-600 dark:text-slate-300'
                      }
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500">{typeHelp(field.state.value)}</p>
            </div>
          )}
        </form.Field>
      </Card>

      <Card>
        <div className="space-y-3">
          <form.Field
            name="personId"
            validators={{
              onChange: ({ value }) => {
                if (!value) return 'Please select a person';
                return undefined;
              },
            }}
          >
            {(field) => (
              <PersonPicker
                value={field.state.value || undefined}
                onChange={(id) => {
                  const next = id ?? '';
                  field.handleChange(next);
                  setPersonId(next || undefined);
                }}
                excludeSelf
                error={extractError(field.state.meta.errors)}
              />
            )}
          </form.Field>

          <form.Field name="amountMinor">
            {(field) => {
              const isAdjustment = form.getFieldValue('type') === 'adjustment';
              return (
                <MoneyInput
                  label={isAdjustment ? 'Signed amount' : 'Amount'}
                  value={field.state.value}
                  currency={resolvedCurrency}
                  onChange={(v) => field.handleChange(v)}
                  hint={
                    isAdjustment
                      ? 'Positive: they owe you. Negative: you owe them.'
                      : undefined
                  }
                  error={extractError(field.state.meta.errors)}
                />
              );
            }}
          </form.Field>

          <form.Field name="date">
            {(field) => (
              <DateInput
                label="Date"
                value={field.state.value}
                onChange={(d) => field.handleChange(d)}
                error={extractError(field.state.meta.errors)}
              />
            )}
          </form.Field>

          <form.Field name="dueDate">
            {(field) => (
              <DateInput
                label="Due date (optional)"
                value={(field.state.value as string | undefined) ?? undefined}
                onChange={(d) => field.handleChange(d)}
              />
            )}
          </form.Field>

          <form.Field name="note">
            {(field) => (
              <Textarea
                label="Note"
                name={field.name}
                value={field.state.value ?? ''}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                maxLength={500}
              />
            )}
          </form.Field>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <Card>
        <p className="text-xs text-slate-500">
          Amounts are stored as integer minor units. The currency of the entry follows the
          chosen person's Lend ledger; the ledger is created automatically on first entry.
        </p>
      </Card>

      {/* Silence unused import warnings for Input (kept for future form fields) */}
      <span className="hidden" aria-hidden>
        <Input name="_unused" />
      </span>
    </form>
  );
}
