/**
 * LendEntryForm — normal user flow for lending and repayments.
 */

import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { z } from 'zod';
import {
  Card,
  Button,
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

const FormSchema = z.object({
  personId: z.string().min(1, 'Please select a person'),
  type: LendEntryTypeSchema,
  amountMinor: z.number().int().refine((n) => n !== 0, 'Amount must not be zero'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD').optional().or(z.literal('')),
  note: z.string().max(500).optional().or(z.literal('')),
});
type FormValues = z.infer<typeof FormSchema>;

const TYPE_OPTIONS: Array<{ value: LendEntryType; label: string; tone: 'emerald' | 'rose' | 'sky' }> = [
  { value: 'lent', label: 'I lent money', tone: 'emerald' },
  { value: 'borrowed', label: 'I borrowed money', tone: 'rose' },
  { value: 'repayment_received', label: 'They repaid me', tone: 'sky' },
  { value: 'repayment_given', label: 'I repaid them', tone: 'sky' },
];

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
  defaultType?: LendEntryType;
  defaultPersonId?: string;
  onSaved?: (entryId: string) => void;
  onCancel?: () => void;
}

function typeHelp(type: LendEntryType): string {
  switch (type) {
    case 'lent':
      return 'Money you gave this person. This increases what they owe you.';
    case 'borrowed':
      return 'Money you received from this person. This increases what you owe them.';
    case 'repayment_received':
      return 'A payment you received from this person.';
    case 'repayment_given':
      return 'A payment you made to this person.';
    case 'adjustment':
      return 'Adjustment';
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
    validators: { onChange: FormSchema },
    onSubmit: async ({ value }) => {
      setSubmitting(true);
      try {
        if (!value.personId) throw new Error('Please select a person');
        const ledger = await lendLedgerRepository.getOrCreate(value.personId, resolvedCurrency);
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
        onSaved?.(created.id);
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
        <h1 className="text-lg font-semibold">Add Lend entry</h1>
      </header>

      <Card>
        <form.Field name="type">
          {(field) => (
            <div className="space-y-2">
              <label className="label">What happened?</label>
              <div className="grid grid-cols-2 gap-2">
                {TYPE_OPTIONS.map((opt) => {
                  const active = field.state.value === opt.value;
                  const toneActive =
                    opt.tone === 'emerald'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200'
                      : opt.tone === 'rose'
                        ? 'border-rose-600 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-200'
                        : 'border-sky-600 bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-200';
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => field.handleChange(opt.value)}
                      aria-pressed={active}
                      className={
                        active
                          ? `min-h-11 rounded-xl border px-3 py-2 text-sm font-medium ${toneActive}`
                          : 'min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300'
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
            validators={{ onChange: ({ value }) => (!value ? 'Please select a person' : undefined) }}
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
            {(field) => (
              <MoneyInput
                label="Amount"
                value={field.state.value}
                currency={resolvedCurrency}
                onChange={(v) => field.handleChange(v)}
                error={extractError(field.state.meta.errors)}
              />
            )}
          </form.Field>

          <form.Field name="date">
            {(field) => (
              <DateInput label="Date" value={field.state.value} onChange={(d) => field.handleChange(d)} error={extractError(field.state.meta.errors)} />
            )}
          </form.Field>

          <details className="rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
            <summary className="cursor-pointer text-sm font-medium">More details</summary>
            <div className="mt-3 space-y-3">
              <form.Field name="dueDate">
                {(field) => (
                  <DateInput label="Due date (optional)" value={(field.state.value as string | undefined) ?? undefined} onChange={(d) => field.handleChange(d)} />
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
          </details>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save entry'}</Button>
      </div>
    </form>
  );
}
