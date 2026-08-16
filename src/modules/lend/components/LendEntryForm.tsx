import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { z } from 'zod';
import { ArrowDownLeft, ArrowLeft, ArrowUpRight } from 'lucide-react';
import {
  Button,
  Card,
  DateInput,
  MoneyInput,
  Spinner,
  Textarea,
  useCelebration,
  useToast,
} from '@components/ui';
import { PersonField } from '@shared/people/components/PersonField';
import { useAppSettings } from '@shared/settings/useSettings';
import { todayDateOnly } from '@shared/dates';
import type { CurrencyCode } from '@shared/money';
import { lendEntryRepository } from '../repositories/lendEntryRepository';
import { lendLedgerRepository } from '../repositories/lendLedgerRepository';
import type { LendEntryInput } from '../domain/validation';
import {
  resolveQuickLendEntryType,
  wouldQuickLendEntryCrossBalance,
  type LendQuickDirection,
} from '../domain/quickEntry';
import { useLendPersonDetail } from '../queries';

const FormSchema = z.object({
  personId: z.string().min(1, 'Please select a person'),
  direction: z.enum(['gave', 'got']),
  amountMinor: z.number().int().positive('Amount must be greater than zero'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD').optional().or(z.literal('')),
  note: z.string().max(500).optional().or(z.literal('')),
});
type FormValues = z.infer<typeof FormSchema>;

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
  defaultDirection?: LendQuickDirection;
  defaultPersonId?: string;
  onSaved?: (entryId: string) => void;
  onCancel?: () => void;
}

function directionHelp(direction: LendQuickDirection, balanceMinor: number): string {
  if (direction === 'gave') {
    return balanceMinor < 0
      ? 'This counts as repayment against what you owe them.'
      : 'Money left you. This increases what they owe you.';
  }
  return balanceMinor > 0
    ? 'This counts as their repayment against what they owe you.'
    : 'Money came to you. This increases what you owe them.';
}

export function LendEntryForm(props: LendEntryFormProps) {
  const settings = useAppSettings();
  if (!settings) {
    return <div className="grid min-h-[40vh] place-items-center"><Spinner /></div>;
  }
  return <ReadyLendEntryForm {...props} defaultCurrency={settings.defaultCurrency} />;
}

function ReadyLendEntryForm({
  defaultDirection = 'gave',
  defaultPersonId,
  defaultCurrency,
  onSaved,
  onCancel,
}: LendEntryFormProps & { defaultCurrency: CurrencyCode }) {
  const toast = useToast();
  const { celebrate } = useCelebration();
  const [submitting, setSubmitting] = useState(false);
  const [personId, setPersonId] = useState<string | undefined>(defaultPersonId);
  const detail = useLendPersonDetail(personId);
  const currentBalanceMinor = detail?.totalBalance ?? 0;
  const resolvedCurrency = (detail?.currency ?? defaultCurrency) as CurrencyCode;
  const balanceReady = !personId || detail !== undefined;

  const form = useForm({
    defaultValues: {
      personId: defaultPersonId ?? '',
      direction: defaultDirection,
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
        if (!detail) throw new Error('Please wait for this balance to load');
        if (wouldQuickLendEntryCrossBalance(value.direction, currentBalanceMinor, value.amountMinor)) {
          throw new Error('This would cross the current balance. Settle it first, then record the remainder separately.');
        }

        const ledger = await lendLedgerRepository.getOrCreate(value.personId, resolvedCurrency);
        const type = resolveQuickLendEntryType(value.direction, currentBalanceMinor);
        const cleaned: LendEntryInput = {
          ledgerId: ledger.id,
          type,
          amountMinor: value.amountMinor,
          date: value.date,
          dueDate: value.dueDate || undefined,
          note: typeof value.note === 'string' ? value.note.trim() || undefined : undefined,
        };
        const created = await lendEntryRepository.create(cleaned);
        const message = value.direction === 'gave' ? 'Amount given recorded' : 'Amount received recorded';
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
          <h1 className="text-xl font-semibold tracking-[-0.035em]">Add Lend entry</h1>
        </div>
      </header>

      <Card>
        <div className="space-y-4">
          <form.Field name="personId" validators={{ onChange: ({ value }) => (!value ? 'Please select a person' : undefined) }}>
            {(field) => (
              <PersonField
                value={field.state.value || undefined}
                onChange={(id) => {
                  const next = id ?? '';
                  field.handleChange(next);
                  setPersonId(next || undefined);
                }}
                error={extractError(field.state.meta.errors)}
                disabled={submitting}
              />
            )}
          </form.Field>

          <form.Field name="direction">
            {(field) => (
              <div className="space-y-3">
                <label className="label">What happened?</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => field.handleChange('gave')}
                    aria-pressed={field.state.value === 'gave'}
                    className={field.state.value === 'gave'
                      ? 'flex min-h-16 items-center justify-center gap-2 rounded-[17px] border border-rose-500/25 bg-rose-500/[0.09] px-3 text-sm font-semibold text-rose-700 shadow-soft-xs transition-transform active:scale-[0.98] dark:text-rose-200'
                      : 'flex min-h-16 items-center justify-center gap-2 rounded-[17px] border border-slate-900/[0.06] bg-white/60 px-3 text-sm font-semibold text-slate-500 transition-[transform,border-color,background-color,color] hover:border-rose-500/15 hover:bg-rose-500/[0.04] hover:text-rose-700 active:scale-[0.98] dark:border-white/[0.07] dark:bg-white/[0.03] dark:hover:text-rose-200'}
                  >
                    <ArrowUpRight size={17} /> You gave
                  </button>
                  <button
                    type="button"
                    onClick={() => field.handleChange('got')}
                    aria-pressed={field.state.value === 'got'}
                    className={field.state.value === 'got'
                      ? 'flex min-h-16 items-center justify-center gap-2 rounded-[17px] border border-emerald-500/25 bg-emerald-500/[0.09] px-3 text-sm font-semibold text-emerald-700 shadow-soft-xs transition-transform active:scale-[0.98] dark:text-emerald-200'
                      : 'flex min-h-16 items-center justify-center gap-2 rounded-[17px] border border-slate-900/[0.06] bg-white/60 px-3 text-sm font-semibold text-slate-500 transition-[transform,border-color,background-color,color] hover:border-emerald-500/15 hover:bg-emerald-500/[0.04] hover:text-emerald-700 active:scale-[0.98] dark:border-white/[0.07] dark:bg-white/[0.03] dark:hover:text-emerald-200'}
                  >
                    <ArrowDownLeft size={17} /> You got
                  </button>
                </div>
                <p className="text-xs leading-5 text-slate-500">
                  {personId && !balanceReady ? 'Loading this person’s balance…' : directionHelp(field.state.value, currentBalanceMinor)}
                </p>
              </div>
            )}
          </form.Field>
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <form.Field name="amountMinor">
            {(field) => (
              <MoneyInput
                label="Amount"
                value={field.state.value}
                currency={resolvedCurrency}
                onChange={(value) => field.handleChange(value)}
                error={extractError(field.state.meta.errors)}
                autoFocus={!!defaultPersonId}
              />
            )}
          </form.Field>
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
        <Button type="submit" disabled={submitting || !balanceReady} size="lg">{submitting ? 'Saving…' : 'Save entry'}</Button>
      </div>
    </form>
  );
}
