import { useNavigate, useSearch } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Card, Button, MoneyInput, useToast, Spinner, Money } from '@components/ui';
import { useAppSettings } from '@shared/settings/useSettings';
import { useTrackMonthlySummary } from '@modules/track/queries';
import { trackBudgetRepository } from '@modules/track/repositories/trackBudgetRepository';
import { getDB } from '@db/database';
import { isValidMonthKey, toMonthKey } from '@shared/dates';
import { TrackBudgetInputSchema } from '@modules/track/domain/validation';
import type { TrackBudget } from '@db/schema';

export function TrackBudgetPage() {
  const search = useSearch({ strict: false }) as { month?: string };
  const settings = useAppSettings();
  const requested = search.month && isValidMonthKey(search.month) ? search.month : toMonthKey();
  const budget = useLiveQuery(async () => {
    const rows = await getDB().trackBudgets.toArray();
    return rows.find((row) => !row.deletedAt && row.month === requested) ?? null;
  }, [requested]);

  if (!settings || budget === undefined) {
    return <div className="grid min-h-[40vh] place-items-center"><Spinner /></div>;
  }

  return (
    <TrackBudgetForm
      key={`${requested}:${budget?.id ?? 'new'}:${settings.defaultCurrency}`}
      month={requested}
      budget={budget}
      currency={settings.defaultCurrency}
      hideAmounts={settings.hideAmounts}
    />
  );
}

function TrackBudgetForm({ month, budget, currency, hideAmounts }: { month: string; budget: TrackBudget | null; currency: string; hideAmounts: boolean }) {
  const navigate = useNavigate();
  const toast = useToast();
  const summary = useTrackMonthlySummary(month);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm({
    defaultValues: {
      month,
      amountMinor: budget?.amountMinor ?? 0,
      currency: budget?.currency ?? currency,
    },
    validators: { onChange: TrackBudgetInputSchema },
    onSubmit: async ({ value }) => {
      setSubmitting(true);
      try {
        await trackBudgetRepository.setForMonth({ month: value.month, amountMinor: value.amountMinor, currency: value.currency });
        toast.show('Budget saved');
        navigate({ to: '/track' });
      } catch (err) {
        toast.show(err instanceof Error ? err.message : 'Could not save', { variant: 'error' });
        setSubmitting(false);
      }
    },
  });

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

  const isCurrent = month === toMonthKey();

  return (
    <div className="space-y-4">
      <header className="flex min-w-0 items-center gap-2">
        <button type="button" onClick={() => navigate({ to: '/track' })} aria-label="Back" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><ArrowLeft size={18} /></button>
        <h1 className="min-w-0 truncate text-lg font-semibold">Budget · {month}</h1>
      </header>

      {summary && (
        <Card>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="min-w-0"><p className="section-title">Spent</p><p className="truncate text-lg font-semibold"><Money value={{ amountMinor: summary.spentMinor, currency: summary.currency }} hide={hideAmounts} /></p></div>
            <div className="min-w-0"><p className="section-title">Income</p><p className="truncate text-lg font-semibold"><Money value={{ amountMinor: summary.incomeMinor, currency: summary.currency }} hide={hideAmounts} /></p></div>
            {summary.budget && <div className="col-span-2"><p className="section-title">Remaining</p><p className={summary.budget.remainingMinor < 0 ? 'text-lg font-semibold text-rose-600 dark:text-rose-300' : 'text-lg font-semibold text-emerald-600 dark:text-emerald-300'}><Money value={{ amountMinor: summary.budget.remainingMinor, currency: summary.currency }} hide={hideAmounts} /></p></div>}
          </div>
        </Card>
      )}

      <form onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); void form.handleSubmit(); }} className="space-y-4">
        <Card>
          <form.Field name="amountMinor">
            {(field) => <MoneyInput label={`Budget for ${month}${isCurrent ? ' (this month)' : ''}`} value={field.state.value} currency={currency} onChange={(value) => field.handleChange(value)} />}
          </form.Field>
        </Card>
        <div className="grid grid-cols-2 gap-2">
          {budget ? <Button type="button" variant="danger" onClick={() => void onDelete()} disabled={submitting}><Trash2 size={16} /> Remove</Button> : <Button type="button" variant="ghost" onClick={() => navigate({ to: '/track' })} disabled={submitting}>Cancel</Button>}
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : budget ? 'Update' : 'Save'}</Button>
        </div>
      </form>
    </div>
  );
}
