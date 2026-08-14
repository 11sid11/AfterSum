import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { z } from 'zod';
import {
  Button,
  Card,
  DateInput,
  MoneyInput,
  PersonPicker,
  Spinner,
  Textarea,
  useCelebration,
  useToast,
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
  for (const error of errors) {
    if (error === undefined || error === null) continue;
    if (typeof error === 'string') return error;
    if (typeof error === 'object' && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string') return message;
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
    case 'lent': return 'Money you gave this person. This increases what they owe you.';
    case 'borrowed': return 'Money you received from this person. This increases what you owe them.';
    case 'repayment_received': return 'A payment you received from this person.';
    case 'repayment_given': return 'A payment you made to this person.';
    case 'adjustment': return 'Balance adjustment.';
  }
}

export function LendEntryForm(props: LendEntryFormProps) {
  const settings = useAppSettings();
  if (!settings) {
    return <div className="grid min-h-[40vh] place-items-center"><Spinner /></div>;
  }
  return <ReadyLendEntryForm {...props} defaultCurrency={settings.defaultCurrency} />;
}

function ReadyLendEntryForm({ defaultType = 'lent', defaultPersonId, defaultCurrency, onSaved, onCancel }: LendEntryFormProps & { defaultCurrency: CurrencyCode }) {
  const toast = useToast();
  const { celebrate } = useCelebration();
  const [submitting, setSubmitting] = useState(false);
  const [personId, setPersonId] = useState<string | undefined>(defaultPersonId);
  const existingLedger = useLendLedgerForPerson(personId, defaultCurrency);
  const resolvedCurrency: CurrencyCode = existingLedger?.currency ?? defaultCurrency;

  const form = useForm({
    defaultValues: {
      personId: defaultPersonId ?? '',
      type: defaultType,
      amountMinor: 0,
      date: todayDateOnly(),
      dueDate: '',
      note: '',
    } as FormValues,
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
          dueDate: value.dueDate || undefined,
          note: typeof value.note === 'string' ? value.note.trim() || undefined : undefined,
        };
        const created = await lendEntryRepository.create(cleaned);
        const repayment = value.type === 'repayment_received' || value.type === 'repayment_given';
        const message = repayment ? 'Repayment recorded' : 'Entry added';
        toast.show(message, { variant: 'success' });
        celebrate({ kind: 'added', message });
        onSaved?.(created.id);
      } catch (err) {
        toast.show(err instanceof Error ? err.message : 'Could not save', { variant: 'error' });
        setSubmitting(false);
      }
    },
  });

  return (
    <form onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); void form.handleSubmit(); }} className="form-shell">
      <header className="flex items-center gap-2">
        <button type="button" onClick={onCancel} aria-label="Back" className="icon-button"><ArrowLeft size={18} /></button>
        <div>
          <span className="module-chip mb-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Lend</span>
          <h1 className="text-xl font-semibold tracking-[-0.035em]">Add entry</h1>
        </div>
      </header>

      <Card>
        <form.Field name="type">
          {(field) => (
            <div className="space-y-3">
              <label className="label">What happened?</label>
              <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                {TYPE_OPTIONS.map((option) => {
                  const active = field.state.value === option.value;
                  const activeClass = option.tone === 'emerald'
                    ? 'border-emerald-500/25 bg-emerald-500/[0.09] text-emerald-700 dark:text-emerald-200'
                    : option.tone === 'rose'
                      ? 'border-rose-500/25 bg-rose-500/[0.08] text-rose-700 dark:text-rose-200'
                      : 'border-sky-500/25 bg-sky-500/[0.08] text-sky-700 dark:text-sky-200';
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => field.handleChange(option.value)}
                      aria-pressed={active}
                      className={active
                        ? `min-h-12 rounded-[16px] border px-3 py-2 text-sm font-semibold shadow-soft-xs transition-[transform,border-color,background-color] duration-200 active:scale-[0.98] ${activeClass}`
                        : 'min-h-12 rounded-[16px] border border-slate-900/[0.06] bg-white/60 px-3 py-2 text-sm font-medium text-slate-500 transition-[transform,border-color,background-color,color] duration-200 hover:border-slate-900/[0.1] hover:bg-white hover:text-slate-900 active:scale-[0.98] dark:border-white/[0.07] dark:bg-white/[0.03] dark:text-slate-400 dark:hover:bg-white/[0.055] dark:hover:text-white'}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs leading-5 text-slate-500">{typeHelp(field.state.value)}</p>
            </div>
          )}
        </form.Field>
      </Card>

      <Card>
        <div className="space-y-4">
          <form.Field name="personId" validators={{ onChange: ({ value }) => (!value ? 'Please select a person' : undefined) }}>
            {(field) => <PersonPicker value={field.state.value || undefined} onChange={(id) => { const next = id ?? ''; field.handleChange(next); setPersonId(next || undefined); }} excludeSelf error={extractError(field.state.meta.errors)} />}
          </form.Field>
          <form.Field name="amountMinor">{(field) => <MoneyInput label="Amount" value={field.state.value} currency={resolvedCurrency} onChange={(value) => field.handleChange(value)} error={extractError(field.state.meta.errors)} />}</form.Field>
          <form.Field name="date">{(field) => <DateInput label="Date" value={field.state.value} onChange={(date) => field.handleChange(date)} error={extractError(field.state.meta.errors)} />}</form.Field>
          <details className="rounded-[17px] border border-slate-900/[0.06] bg-slate-900/[0.02] px-3.5 py-3 dark:border-white/[0.07] dark:bg-white/[0.025]">
            <summary className="cursor-pointer text-sm font-semibold tracking-[-0.01em]">More details</summary>
            <div className="mt-4 space-y-4">
              <form.Field name="dueDate">{(field) => <DateInput label="Due date (optional)" value={field.state.value || undefined} onChange={(date) => field.handleChange(date)} />}</form.Field>
              <form.Field name="note">{(field) => <Textarea label="Note" name={field.name} value={field.state.value ?? ''} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} maxLength={500} placeholder="Optional" />}</form.Field>
            </div>
          </details>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2.5">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting} size="lg">Cancel</Button>
        <Button type="submit" disabled={submitting} size="lg">{submitting ? 'Saving…' : 'Save entry'}</Button>
      </div>
    </form>
  );
}
