/** Shared view for a single month of Track data. */

import { useNavigate } from '@tanstack/react-router';
import { Plus, Tags, Wallet, ListFilter, X } from 'lucide-react';
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
  const [type, setType] = useState<TrackTransactionType | undefined>();
  const [text, setText] = useState('');
  // undefined = no category filter, null = uncategorised, string = category id.
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null | undefined>();

  const filters = useMemo<TrackTransactionFilters>(
    () => ({
      type,
      text: text.trim() || undefined,
      month,
      categoryId: typeof selectedCategoryId === 'string' ? selectedCategoryId : undefined,
    }),
    [type, text, month, selectedCategoryId],
  );

  const queriedMonthTxs = useTrackTransactionsForMonth(month, filters);
  const monthTxs = useMemo(() => {
    if (!queriedMonthTxs) return undefined;
    if (selectedCategoryId === null) {
      return queriedMonthTxs.filter((transaction) => !transaction.categoryId);
    }
    return queriedMonthTxs;
  }, [queriedMonthTxs, selectedCategoryId]);

  const currentMonth = toMonthKey(new Date(todayDateOnly()));
  const isCurrentMonth = month === currentMonth;
  const hide = settings?.hideAmounts ?? false;

  useEffect(() => {
    if (!/^\d{4}-\d{2}$/.test(month)) navigate({ to: '/track', replace: true });
  }, [month, navigate]);

  if (summary === undefined) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner />
      </div>
    );
  }

  const selectedCategoryName =
    selectedCategoryId === null
      ? 'Uncategorised'
      : typeof selectedCategoryId === 'string'
        ? summary.byCategory.find((row) => row.categoryId === selectedCategoryId)?.categoryName
        : undefined;

  const onAdd = (defaultType: TrackTransactionType) =>
    navigate({ to: '/track/add', search: { type: defaultType } });

  const changeType = (nextType: TrackTransactionType | undefined) => {
    setType(nextType);
    if (nextType !== 'expense') setSelectedCategoryId(undefined);
  };

  const toggleCategory = (categoryId: string | null) => {
    const isAlreadySelected = selectedCategoryId === categoryId;
    setSelectedCategoryId(isAlreadySelected ? undefined : categoryId);
    if (!isAlreadySelected) setType('expense');
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
            className="grid h-11 w-11 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Tags size={18} />
          </button>
          <button
            type="button"
            onClick={() => navigate({ to: '/track/budget', search: { month } })}
            aria-label="Monthly budget"
            className="grid h-11 w-11 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Wallet size={18} />
          </button>
        </div>
      </header>

      <MonthNavigator month={month} disableNextIfCurrent currentMonth={currentMonth} />

      <Card>
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <p className="section-title">Spent</p>
            <p className="truncate text-2xl font-semibold text-rose-600 dark:text-rose-300">
              <Money value={{ amountMinor: summary.spentMinor, currency: summary.currency }} hide={hide} />
            </p>
          </div>
          <div className="min-w-0">
            <p className="section-title">Income</p>
            <p className="truncate text-2xl font-semibold text-emerald-600 dark:text-emerald-300">
              <Money value={{ amountMinor: summary.incomeMinor, currency: summary.currency }} hide={hide} />
            </p>
          </div>
          {summary.budget && (
            <div className="col-span-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">Budget</span>
                <span className="min-w-0 truncate text-right text-slate-500">
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="grid w-full grid-cols-3 rounded-xl border border-slate-200 bg-white p-0.5 text-xs dark:border-slate-700 dark:bg-slate-900 sm:w-auto sm:shrink-0 sm:rounded-full">
            {[
              { key: undefined, label: 'All' },
              { key: 'expense' as const, label: 'Expense' },
              { key: 'income' as const, label: 'Income' },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => changeType(option.key)}
                aria-pressed={type === option.key}
                className={
                  type === option.key
                    ? 'min-h-9 rounded-lg bg-brand-600 px-3 py-1 font-medium text-white sm:rounded-full'
                    : 'min-h-9 rounded-lg px-3 py-1 text-slate-600 hover:text-slate-900 dark:text-slate-300 sm:rounded-full'
                }
              >
                {option.label}
              </button>
            ))}
          </div>
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 sm:rounded-full">
            <ListFilter size={14} className="shrink-0 text-slate-400" />
            <input
              type="search"
              placeholder="Search this month…"
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="min-w-0 flex-1 bg-transparent outline-none"
              aria-label="Search Track transactions"
            />
          </label>
        </div>
      )}

      {summary.byCategory.length > 0 && (
        <section>
          <div className="mb-2 flex items-end justify-between gap-3">
            <div>
              <h2 className="section-title">By category</h2>
              <p className="mt-0.5 text-xs text-slate-500">Tap a category to filter the transactions below.</p>
            </div>
          </div>
          <Card>
            <CategoryBreakdown
              rows={summary.byCategory}
              currency={summary.currency}
              totalMinor={summary.spentMinor}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={toggleCategory}
            />
          </Card>
        </section>
      )}

      <section>
        <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
          <h2 className="section-title min-w-0 truncate">
            Transactions{selectedCategoryName ? ` · ${selectedCategoryName}` : ''}
          </h2>
          {selectedCategoryName && (
            <button
              type="button"
              onClick={() => setSelectedCategoryId(undefined)}
              className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/30"
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>
        <Card padded={false}>
          {(monthTxs ?? []).length === 0 ? (
            <div className="px-4 py-4">
              <EmptyState
                title={selectedCategoryName ? `No ${selectedCategoryName.toLocaleLowerCase()} transactions` : 'No transactions this month'}
                description={selectedCategoryName ? 'Clear the category filter or add a transaction.' : 'Add your first one to start tracking.'}
                icon={<Wallet size={28} />}
                action={
                  <Button onClick={() => onAdd('expense')}>
                    <Plus size={16} /> Add expense
                  </Button>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {(monthTxs ?? []).map((transaction) => (
                <li key={transaction.id}>
                  <TransactionListItem transaction={transaction} />
                </li>
              ))}
            </ul>
          )}
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
