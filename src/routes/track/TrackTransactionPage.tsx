/**
 * View/edit a single Track transaction by id.
 *
 * Shows the form, plus a Delete button that soft-deletes the
 * record and shows an Undo toast. The route is /track/transaction/$transactionId.
 */

import { useNavigate, useParams } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { useState } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import {
  Card,
  Button,
  Input,
  Textarea,
  MoneyInput,
  DateInput,
  CategoryPicker,
  PaymentMethodPicker,
  useToast,
  Spinner,
  Money,
} from '@components/ui';
import { useAppSettings } from '@shared/settings/useSettings';
import { useTrackTransaction } from '@modules/track/queries';
import { trackTransactionRepository } from '@modules/track/repositories/trackTransactionRepository';
import { TrackTransactionInputSchema } from '@modules/track/domain/validation';
import { formatHumanDateTime } from '@shared/dates';

const FormSchema = TrackTransactionInputSchema;
type FormValues = z.infer<typeof FormSchema>;

export function TrackTransactionPage() {
  const { transactionId } = useParams({ strict: false }) as { transactionId?: string };
  const navigate = useNavigate();
  const settings = useAppSettings();
  const toast = useToast();
  const transaction = useTrackTransaction(transactionId);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!settings) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner />
      </div>
    );
  }

  if (transaction === undefined) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner />
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="space-y-3">
        <header className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate({ to: '/track' })}
            aria-label="Back"
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-semibold">Transaction</h1>
        </header>
        <Card>
          <p className="text-sm text-slate-500">This transaction no longer exists.</p>
        </Card>
      </div>
    );
  }

  const initialValues: FormValues = {
    type: transaction.type,
    title: transaction.title,
    amountMinor: transaction.amountMinor,
    currency: transaction.currency,
    categoryId: transaction.categoryId ?? '',
    paymentMethod: transaction.paymentMethod,
    date: transaction.date,
    note: transaction.note ?? '',
  };

  const form = useForm({
    defaultValues: initialValues,
    validators: { onChange: FormSchema },
    onSubmit: async ({ value }) => {
      setSubmitting(true);
      try {
        await trackTransactionRepository.update(transaction.id, {
          type: value.type,
          title: value.title.trim(),
          amountMinor: value.amountMinor,
          currency: value.currency,
          categoryId: value.categoryId || undefined,
          paymentMethod: value.paymentMethod,
          date: value.date,
          note: value.note || undefined,
        });
        toast.show('Saved');
        navigate({ to: '/track' });
      } catch (err) {
        toast.show(err instanceof Error ? err.message : 'Could not save', { variant: 'error' });
        setSubmitting(false);
      }
    },
  });

  const onDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await trackTransactionRepository.softDelete(transaction.id);
      const snapshot = { ...transaction };
      toast.show('Transaction deleted', {
        action: {
          label: 'Undo',
          onClick: async () => {
            await trackTransactionRepository.restore(snapshot.id);
          },
        },
      });
      navigate({ to: '/track' });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not delete', { variant: 'error' });
      setDeleting(false);
    }
  };

  const isExpense = transaction.type === 'expense';

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
        <h1 className="text-lg font-semibold">Edit transaction</h1>
      </header>

      <Card>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm text-slate-500">{isExpense ? 'Spent' : 'Received'}</p>
          <p
            className={
              isExpense
                ? 'text-2xl font-semibold text-rose-600 dark:text-rose-300'
                : 'text-2xl font-semibold text-emerald-600 dark:text-emerald-300'
            }
          >
            <Money
              value={{ amountMinor: transaction.amountMinor, currency: transaction.currency }}
              hide={settings?.hideAmounts ?? false}
              signed
            />
          </p>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Created {formatHumanDateTime(transaction.createdAt)} · revision {transaction.revision}
        </p>
      </Card>

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
              <div className="mb-3 inline-flex w-full rounded-full border border-slate-200 bg-white p-0.5 text-sm dark:border-slate-700 dark:bg-slate-900">
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

          <div className="space-y-3">
            <form.Field name="title">
              {(field) => (
                <Input
                  label="Title"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              )}
            </form.Field>

            <form.Field name="amountMinor">
              {(field) => (
                <MoneyInput
                  label="Amount"
                  value={field.state.value}
                  currency={transaction.currency}
                  onChange={(v) => field.handleChange(v)}
                />
              )}
            </form.Field>

            <form.Field name="date">
              {(field) => (
                <DateInput value={field.state.value} onChange={(d) => field.handleChange(d)} label="Date" />
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
                <PaymentMethodPicker value={field.state.value} onChange={(m) => field.handleChange(m)} />
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
            variant="danger"
            onClick={onDelete}
            disabled={deleting || submitting}
          >
            <Trash2 size={16} /> {deleting ? 'Deleting…' : 'Delete'}
          </Button>
          <Button type="submit" disabled={submitting || deleting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </div>
  );
}
