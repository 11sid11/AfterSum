/**
 * View / set the Track budget for a month.
 *
 * Reads `?month=YYYY-MM` from the URL. If absent, defaults to
 * the current month. The form persists via
 * `trackBudgetRepository.setForMonth()` which is upsert
 * semantics.
 */

import { useNavigate, useSearch } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Card, Button, MoneyInput, useToast, Spinner, Money } from '@components/ui';
import { useAppSettings } from '@shared/settings/useSettings';
import { useTrackBudget, useTrackMonthlySummary } from '@modules/track/queries';
import { trackBudgetRepository } from '@modules/track/repositories/trackBudgetRepository';
import { toMonthKey, todayDateOnly } from '@shared/dates';
import { TrackBudgetInputSchema } from '@modules/track/domain/validation';

export function TrackBudgetPage() {
  const search = useSearch({ strict: false }) as { month?: string };
  const navigate = useNavigate();
  const settings = useAppSettings();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  const requested = search?.month && /^\d{4}-\d{2}$/.test(search.month) ? search.month : toMonthKey();
  const budget = useTrackBudget(requested);
  const summary = useTrackMonthlySummary(requested);
  const [draftAmount, setDraftAmount] = useState<number | undefined>(budget?.amountMinor);

  const form = useForm({
    defaultValues: {
      month: requested,
      amountMinor: budget?.amountMinor ?? 0,
      currency: budget?.currency ?? settings?.defaultCurrency ?? 'INR',
    },
    validators: { onChange: TrackBudgetInputSchema },
    onSubmit: async ({ value }) => {
      setSubmitting(true);
      try {
        await trackBudgetRepository.setForMonth({
          month: value.month,
          amountMinor: value.amountMinor,
          currency: value.currency,
        });
        toast.show('Budget saved');
        navigate({ to: '/track' });
      } catch (err) {
        toast.show(err instanceof Error ? err.message : 'Could not save', { variant: 'error' });
        setSubmitting(false);
      }
    },
  });

  if (!settings) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner />
      </div>
    );
  }

  const onDelete = async () => {
    if (!budget) return;
    try {
      await trackBudgetRepository.delete(budget.id);
      toast.show('Budget removed');
      navigate({ to: '/track' });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not delete', { variant: 'error' });
    }
  };

  const isCurrent = requested === toMonthKey(new Date(todayDateOnly()));
  const hide = settings.hideAmounts ?? false;

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
        <h1 className="text-lg font-semibold">Budget · {requested}</h1>
      </header>

      {summary && (
        <Card>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="section-title">Spent</p>
              <p className="text-lg font-semibold">
                <Money value={{ amountMinor: summary.spentMinor, currency: summary.currency }} hide={hide} />
              </p>
            </div>
            <div>
              <p className="section-title">Income</p>
              <p className="text-lg font-semibold">
                <Money value={{ amountMinor: summary.incomeMinor, currency: summary.currency }} hide={hide} />
              </p>
            </div>
            {summary.budget && (
              <div className="col-span-2">
                <p className="section-title">Remaining</p>
                <p
                  className={
                    summary.budget.remainingMinor < 0
                      ? 'text-lg font-semibold text-rose-600 dark:text-rose-300'
                      : 'text-lg font-semibold text-emerald-600 dark:text-emerald-300'
                  }
                >
                  <Money
                    value={{ amountMinor: summary.budget.remainingMinor, currency: summary.currency }}
                    hide={hide}
                  />
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
        className="space-y-4"
      >
        <Card>
          <form.Field name="amountMinor">
            {(field) => (
              <MoneyInput
                label={`Budget for ${requested}${isCurrent ? ' (this month)' : ''}`}
                value={field.state.value || draftAmount}
                currency={settings.defaultCurrency}
                onChange={(v) => {
                  setDraftAmount(v);
                  field.handleChange(v);
                }}
              />
            )}
          </form.Field>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          {budget ? (
            <Button type="button" variant="danger" onClick={onDelete} disabled={submitting}>
              <Trash2 size={16} /> Remove
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={() => navigate({ to: '/track' })} disabled={submitting}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : budget ? 'Update' : 'Save'}
          </Button>
        </div>
      </form>
    </div>
  );
}
