/**
 * Shared view for a single month of Track data.
 */

import { useNavigate } from '@tanstack/react-router';
import { Plus, Settings, Wallet, ListFilter } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Card, Button, Money, EmptyState, Spinner } from '@components/ui';
import { useAppSettings } from '@shared/settings/useSettings';
import { useTrackMonthlySummary, useTrackTransactionsForMonth } from '../queries';
import { todayDateOnly, toMonthKey } from '@shared/dates';
import { MonthNavigator } from './MonthNavigator';
import { TransactionListItem } from './TransactionListItem';
import { CategoryBreakdown } from './CategoryBreakdown';
import type { TrackTransactionType } from '@db/schema';
import type { TrackTransactionFilters } from '../domain/types';

interface TrackMonthViewProps {
  month: string;
  showFilters?: boolean;
}

export function TrackMonthView({ month, showFilters = true }: TrackMonthViewProps) {
  const navigate = useNavigate();
  const settings = useAppSettings();
  const summary = useTrackMonthlySummary(month);
  const [type, setType] = useState<TrackTransactionType | undefined>(undefined);
  const [text, setText] = useState('');

  const filters = useMemo<TrackTransactionFilters>(
    () => ({ type, text: text.trim() || undefined, month }),
    [type, text, month],
  );
  const monthTxs = useTrackTransactionsForMonth(month, filters);

  const currentMonth = toMonthKey(new Date(todayDateOnly()));
  const isCurrentMonth = month === currentMonth;
  const hide = settings?.hideAmounts ?? false;

  useEffect(() => {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      navigate({ to: '/track', replace: true });
    }
  }, [month, navigate]);

  if (summary === undefined) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner />
      </div>
    );
  }

  const onAdd = (defaultType: TrackTransactionType) => {
    navigate({ to: '/track/add', search: { type: defaultType } });
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Track</h1>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate({ to: '/track/categories' })}
            aria-label="Manage categories"
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Settings size={18} />
          </button>
          <button
            type="button"
            onClick={() => navigate({ to: '/track/budget', search: { month } })}
            aria-label="Monthly budget"
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Wallet size={18} />
          </button>
        </div>
      </header>

      <MonthNavigator month={month} disableNextIfCurrent currentMonth={currentMonth} />

      <Card>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="section-title">Spent</p>
            <p className="text-2xl font-semibold text-rose-600 dark:text-rose-300">
              <Money value={{ amountMinor: summary.spentMinor, currency: summary.currency }} hide={hide} />
            </p>
          </div>
          <div>
            <p className="section-title">Income</p>
            <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-300">
              <Money value={{ amountMinor: summary.incomeMinor, currency: summary.currency }} hide={hide} />
            </p>
          </div>
          {summary.budget && (
            <div className="col-span-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium">Budget</span>
                <span className="text-slate-500">
                  {summary.budget.remainingMinor >= 0 ? (
                    <>
                      <Money value={{ amountMinor: summary.budget.remainingMinor, currency: summary.currency }} hide={hide} /> left
                    </>
                  ) : (
                    <>
                      Over by <Money value={{ amountMinor: Math.abs(summary.budget.remainingMinor), currency: summary.currency }} hide={hide} />
                    </>
                  )}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className={summary.budget.percent > 100 ? 'h-full rounded-full bg-rose-500' : 'h-full rounded-full bg-brand-500'}
                  style={{ width: `${Math.min(100, summary.budget.percent)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                of <Money value={{ amountMinor: summary.budget.amountMinor, currency: summary.currency }} hide={hide} /> · {summary.budget.percent}%
              </p>
            </div>
          )}
        </div>
        {!summary.budget && (
          <button
            type="button"
            onClick={() => navigate({ to: '/track/budget', search: { month } })}
            className="mt-2 text-xs font-medium text-brand-600 hover:underline"
          >
            Set a monthly budget
          </button>
        )}
      </Card>

      {showFilters && (
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 text-xs dark:border-slate-700 dark:bg-slate-900">
            {[
              { key: undefined, label: 'All' },
              { key: 'expense' as const, label: 'Expense' },
              { key: 'income' as const, label: 'Income' },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setType(opt.key)}
                aria-pressed={type === opt.key}
                className={
                  type === opt.key
                    ? 'rounded-full bg-brand-600 px-3 py-1 font-medium text-white'
                    : 'rounded-full px-3 py-1 text-slate-600 hover:text-slate-900 dark:text-slate-300'
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex flex-1 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm dark:border-slate-700 dark:bg-slate-900">
            <ListFilter size={14} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="flex-1 bg-transparent outline-none"
            />
          </div>
        </div>
      )}

      {summary.byCategory.length > 0 && (
        <section>
          <h2 className="section-title mb-2">By category</h2>
          <Card>
            <CategoryBreakdown rows={summary.byCategory} currency={summary.currency} totalMinor={summary.spentMinor} />
          </Card>
        </section>
      )}

      <section>
        <h2 className="section-title mb-2">Transactions</h2>
        <Card padded={false}>
          {(() => {
            const list = monthTxs ?? [];
            if (list.length === 0) {
              return (
                <div className="px-4 py-4">
                  <EmptyState
                    title="No transactions this month"
                    description="Add your first one to start tracking."
                    icon={<Wallet size={28} />}
                    action={
                      <Button onClick={() => onAdd('expense')}>
                        <Plus size={16} /> Add expense
                      </Button>
                    }
                  />
                </div>
              );
            }
            return (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {list.map((t) => (
                  <li key={t.id}>
                    <TransactionListItem transaction={t} />
                  </li>
                ))}
              </ul>
            );
          })()}
        </Card>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => onAdd('expense')} block>
          <Plus size={16} /> Expense
        </Button>
        <Button variant="secondary" onClick={() => onAdd('income')} block>
          <Plus size={16} /> Income
        </Button>
      </div>

      {!isCurrentMonth && (
        <button
          type="button"
          onClick={() => navigate({ to: '/track' })}
          className="block w-full text-center text-xs text-slate-500 hover:underline"
        >
          Jump to this month
        </button>
      )}
    </div>
  );
}
