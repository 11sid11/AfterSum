/**
 * Add a Track transaction.
 *
 * Uses TanStack Form with the Zod schema from
 * `modules/track/domain/validation`. Reads `?type=` from the
 * URL to prefill the type.
 */

import { useNavigate, useSearch } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Card, Button, Input, Textarea, MoneyInput, DateInput, CategoryPicker, PaymentMethodPicker, useToast, Spinner } from '@components/ui';
import { useAppSettings } from '@shared/settings/useSettings';
import { todayDateOnly } from '@shared/dates';
import { trackTransactionRepository } from '@modules/track/repositories/trackTransactionRepository';
import { TrackTransactionInputSchema } from '@modules/track/domain/validation';
import type { TrackTransactionType } from '@db/schema';

const FormSchema = TrackTransactionInputSchema;
type FormValues = z.infer<typeof FormSchema>;

export function TrackAddPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { type?: TrackTransactionType };
  const settings = useAppSettings();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  if (!settings) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner />
      </div>
    );
  }

  const initialType: TrackTransactionType = search?.type === 'income' ? 'income' : 'expense';
  const initialValues: FormValues = {
    type: initialType,
    title: '',
    amountMinor: 0,
    currency: settings.defaultCurrency,
    categoryId: '',
    paymentMethod: undefined,
    date: todayDateOnly(),
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
        const cleaned = {
          type: value.type,
          title: value.title.trim(),
          amountMinor: value.amountMinor,
          currency: value.currency,
          categoryId: value.categoryId || undefined,
          paymentMethod: value.paymentMethod,
          date: value.date,
          note: value.note || undefined,
        };
        await trackTransactionRepository.create(cleaned);
        toast.show(`${cleaned.type === 'expense' ? 'Expense' : 'Income'} added`);
        navigate({ to: '/track' });
      } catch (err) {
        toast.show(err instanceof Error ? err.message : 'Could not save', { variant: 'error' });
        setSubmitting(false);
      }
    },
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate({ to: '/track' })}
          aria-label="Back"
          className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-semibold">Add</h1>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
        className="space-y-4"
      >
        <Card>
          <form.Field name="type">
            {(field) => (
              <div className="inline-flex w-full rounded-full border border-slate-200 bg-white p-0.5 text-sm dark:border-slate-700 dark:bg-slate-900">
                {(['expense', 'income'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => field.handleChange(t)}
                    aria-pressed={field.state.value === t}
                    className={
                      field.state.value === t
                        ? t === 'expense'
                          ? 'flex-1 rounded-full bg-rose-600 px-3 py-1.5 font-medium text-white'
                          : 'flex-1 rounded-full bg-emerald-600 px-3 py-1.5 font-medium text-white'
                        : 'flex-1 rounded-full px-3 py-1.5 text-slate-600 dark:text-slate-300'
                    }
                  >
                    {t === 'expense' ? 'Expense' : 'Income'}
                  </button>
                ))}
              </div>
            )}
          </form.Field>
        </Card>

        <Card>
          <div className="space-y-3">
            <form.Field name="title">
              {(field) => (
                <Input
                  label="Title"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  error={field.state.meta.errors.find((e) => e !== undefined && (e as { message?: string }).message)?.message as string | undefined}
                  placeholder="e.g. Coffee, Salary, Uber"
                  autoFocus
                />
              )}
            </form.Field>

            <form.Field name="amountMinor">
              {(field) => (
                <MoneyInput
                  label="Amount"
                  value={field.state.value}
                  currency={settings.defaultCurrency}
                  onChange={(v) => field.handleChange(v)}
                  error={field.state.meta.errors.find((e) => e !== undefined && (e as { message?: string }).message)?.message as string | undefined}
                />
              )}
            </form.Field>

            <form.Field name="date">
              {(field) => (
                <DateInput
                  label="Date"
                  value={field.state.value}
                  onChange={(d) => field.handleChange(d)}
                  error={field.state.meta.errors.find((e) => e !== undefined && (e as { message?: string }).message)?.message as string | undefined}
                />
              )}
            </form.Field>

            <form.Field name="type">
              {(field) => (
                <CategoryPicker
                  type={field.state.value}
                  value={form.getFieldValue('categoryId') || undefined}
                  onChange={(id) => form.setFieldValue('categoryId', id ?? '')}
                  allowEmpty
                />
              )}
            </form.Field>

            <form.Field name="paymentMethod">
              {(field) => (
                <PaymentMethodPicker
                  value={field.state.value}
                  onChange={(m) => field.handleChange(m)}
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
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate({ to: '/track' })}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </div>
  );
}
