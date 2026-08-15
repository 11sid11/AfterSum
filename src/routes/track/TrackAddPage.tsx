/**
 * Add a Track transaction.
 *
 * The form mounts only after settings are available so its persisted currency
 * can never drift from the currency shown by MoneyInput.
 */

import { useNavigate, useSearch } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  Button,
  Card,
  CategoryPicker,
  DateInput,
  Input,
  MoneyInput,
  PaymentMethodPicker,
  Spinner,
  Textarea,
  useCelebration,
  useToast,
} from '@components/ui';
import { useAppSettings } from '@shared/settings/useSettings';
import { todayDateOnly } from '@shared/dates';
import { trackTransactionRepository } from '@modules/track/repositories/trackTransactionRepository';
import {
  TrackTransactionInputSchema,
  type TrackTransactionInput,
} from '@modules/track/domain/validation';
import type { TrackTransactionType } from '@db/schema';

const FormSchema = TrackTransactionInputSchema;
type FormValues = TrackTransactionInput;

export function TrackAddPage() {
  const settings = useAppSettings();

  if (!settings) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner />
      </div>
    );
  }

  return <TrackAddForm currency={settings.defaultCurrency} />;
}

function TrackAddForm({ currency }: { currency: string }) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { type?: TrackTransactionType };
  const toast = useToast();
  const { celebrate } = useCelebration();
  const [submitting, setSubmitting] = useState(false);
  const initialType: TrackTransactionType = search?.type === 'income' ? 'income' : 'expense';

  const form = useForm({
    defaultValues: {
      type: initialType,
      title: '',
      amountMinor: 0,
      currency,
      categoryId: '',
      paymentMethod: undefined,
      date: todayDateOnly(),
      note: '',
    } as FormValues,
    validators: { onChange: FormSchema },
    onSubmit: async ({ value }) => {
      setSubmitting(true);
      try {
        const cleaned: TrackTransactionInput = {
          type: value.type,
          title: value.title.trim(),
          amountMinor: value.amountMinor,
          currency,
          categoryId: value.categoryId || undefined,
          paymentMethod: value.paymentMethod,
          date: value.date,
          note: value.note?.trim() || undefined,
        };
        await trackTransactionRepository.create(cleaned);
        const message = `${cleaned.type === 'expense' ? 'Expense' : 'Income'} added`;
        toast.show(message, { variant: 'success' });
        celebrate({ kind: 'added', message });
        navigate({ to: '/track' });
      } catch (err) {
        toast.show(err instanceof Error ? err.message : 'Could not save', { variant: 'error' });
        setSubmitting(false);
      }
    },
  });

  return (
    <div className="form-shell">
      <header className="flex items-center gap-2">
        <button type="button" onClick={() => navigate({ to: '/track' })} aria-label="Back" className="icon-button">
          <ArrowLeft size={18} />
        </button>
        <div>
          <span className="module-chip mb-1.5"><span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Track</span>
          <h1 className="text-xl font-semibold tracking-[-0.035em]">Add transaction</h1>
        </div>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
        className="space-y-4"
      >
        <form.Field name="type">
          {(field) => (
            <div className="glass-bar grid grid-cols-2 rounded-[19px] p-1 text-sm">
              {(['expense', 'income'] as const).map((type) => {
                const selected = field.state.value === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      if (selected) return;
                      field.handleChange(type);
                      form.setFieldValue('categoryId', '');
                    }}
                    aria-pressed={selected}
                    className={selected
                      ? type === 'expense'
                        ? 'min-h-10 rounded-[15px] bg-rose-600 px-3 font-semibold text-white shadow-soft-xs'
                        : 'min-h-10 rounded-[15px] bg-emerald-600 px-3 font-semibold text-white shadow-soft-xs'
                      : 'min-h-10 rounded-[15px] px-3 font-semibold text-slate-500 transition-colors hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'}
                  >
                    {type === 'expense' ? 'Expense' : 'Income'}
                  </button>
                );
              })}
            </div>
          )}
        </form.Field>

        <Card>
          <div className="space-y-4">
            <form.Field name="title">
              {(field) => (
                <Input
                  label="Title"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  error={field.state.meta.errors.find((error) => error !== undefined && (error as { message?: string }).message)?.message as string | undefined}
                  placeholder="Coffee, salary, Uber…"
                  autoFocus
                />
              )}
            </form.Field>

            <form.Field name="amountMinor">
              {(field) => (
                <MoneyInput
                  label="Amount"
                  value={field.state.value}
                  currency={currency}
                  onChange={(value) => field.handleChange(value)}
                  error={field.state.meta.errors.find((error) => error !== undefined && (error as { message?: string }).message)?.message as string | undefined}
                />
              )}
            </form.Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field name="date">
                {(field) => (
                  <DateInput
                    label="Date"
                    value={field.state.value}
                    onChange={(date) => field.handleChange(date)}
                    error={field.state.meta.errors.find((error) => error !== undefined && (error as { message?: string }).message)?.message as string | undefined}
                  />
                )}
              </form.Field>

              <form.Subscribe selector={(state) => [state.values.type, state.values.categoryId] as const}>
                {([type, categoryId]) => (
                  <CategoryPicker
                    type={type}
                    value={categoryId || undefined}
                    onChange={(id) => form.setFieldValue('categoryId', id ?? '')}
                    allowEmpty
                  />
                )}
              </form.Subscribe>
            </div>

            <form.Field name="paymentMethod">
              {(field) => (
                <PaymentMethodPicker value={field.state.value} onChange={(method) => field.handleChange(method)} />
              )}
            </form.Field>

            <form.Field name="note">
              {(field) => (
                <Textarea
                  label="Note"
                  name={field.name}
                  value={field.state.value ?? ''}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  maxLength={500}
                  placeholder="Optional"
                />
              )}
            </form.Field>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-2.5">
          <Button type="button" variant="ghost" onClick={() => navigate({ to: '/track' })} disabled={submitting} size="lg">
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} size="lg">
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </div>
  );
}
