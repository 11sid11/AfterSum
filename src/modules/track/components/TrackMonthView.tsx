/** Shared view for a single month of Track data. */

import { useNavigate } from '@tanstack/react-router';
import { ArrowDownRight, ArrowUpRight, Plus, Search, Tags, Wallet, X } from 'lucide-react';
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null | undefined>();

  const filters = useMemo<TrackTransactionFilters>(() => ({
    type,
    text: text.trim() || undefined,
    month,
    categoryId: typeof selectedCategoryId === 'string' ? selectedCategoryId : undefined,
  }), [type, text, month, selectedCategoryId]);

  const queriedMonthTxs = useTrackTransactionsForMonth(month, filters);
  const monthTxs = useMemo(() => {
    if (!queriedMonthTxs) return undefined;
    return selectedCategoryId === null
      ? queriedMonthTxs.filter((transaction) => !transaction.categoryId)
      : queriedMonthTxs;
  }, [queriedMonthTxs, selectedCategoryId]);

  const currentMonth = toMonthKey(new Date(todayDateOnly()));
  const isCurrentMonth = month === currentMonth;
  const hide = settings?.hideAmounts ?? false;

  useEffect(() => {
    if (!/^\d{4}-\d{2}$/.test(month)) navigate({ to: '/track', replace: true });
  }, [month, navigate]);

  if (summary === undefined) return <div className="grid min-h-[40vh] place-items-center"><Spinner /></div>;

  const selectedCategoryName = selectedCategoryId === null
    ? 'Uncategorised'
    : typeof selectedCategoryId === 'string'
      ? summary.byCategory.find((row) => row.categoryId === selectedCategoryId)?.categoryName
      : undefined;

  const onAdd = (defaultType: TrackTransactionType) => navigate({ to: '/track/add', search: { type: defaultType } });
  const changeType = (nextType: TrackTransactionType | undefined) => {
    setType(nextType);
    if (nextType !== 'expense') setSelectedCategoryId(undefined);
  };
  const toggleCategory = (categoryId: string | null) => {
    const selected = selectedCategoryId === categoryId;
    setSelectedCategoryId(selected ? undefined : categoryId);
    if (!selected) setType('expense');
  };

  return (
    <div className="space-y-8">
      <header className="flex min-w-0 items-end justify-between gap-4">
        <div className="min-w-0">
          <span className="module-chip mb-3"><span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Track</span>
          <h1 className="page-title">See where the month is going.</h1>
          <p className="page-subtitle">Everyday income and spending, kept intentionally simple.</p>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <button type="button" onClick={() => navigate({ to: '/track/categories' })} aria-label="Manage categories" className="icon-button"><Tags size={17} /></button>
          <button type="button" onClick={() => navigate({ to: '/track/budget', search: { month } })} aria-label="Monthly budget" className="icon-button"><Wallet size={17} /></button>
        </div>
      </header>

      <div className="max-w-sm"><MonthNavigator month={month} disableNextIfCurrent currentMonth={currentMonth} /></div>

      <section className="hero-panel px-5 py-5 sm:px-7 sm:py-7">
        <div className="relative z-10">
          <div className="grid gap-5 sm:grid-cols-[1.35fr_0.65fr] sm:items-end">
            <div>
              <span className="hero-kicker"><ArrowDownRight size={12} /> Spent</span>
              <p className="mt-3 text-[2.45rem] font-semibold leading-none tracking-[-0.055em] tabular-nums sm:text-[3.2rem]">
                <Money value={{ amountMinor: summary.spentMinor, currency: summary.currency }} hide={hide} emphasize />
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-white/48">
                <ArrowUpRight size={14} className="text-emerald-300/80" />
                <span>Income</span>
                <strong className="font-semibold text-white/80"><Money value={{ amountMinor: summary.incomeMinor, currency: summary.currency }} hide={hide} /></strong>
              </div>
            </div>

            {summary.budget ? (
              <div className="rounded-[20px] border border-white/10 bg-white/[0.065] p-4 backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-white/42">Budget</p>
                    <p className="mt-1 text-sm font-semibold text-white/88">
                      {summary.budget.remainingMinor >= 0
                        ? <><Money value={{ amountMinor: summary.budget.remainingMinor, currency: summary.currency }} hide={hide} /> left</>
                        : <>Over by <Money value={{ amountMinor: Math.abs(summary.budget.remainingMinor), currency: summary.currency }} hide={hide} /></>}
                    </p>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-white/50">{summary.budget.percent}%</span>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={summary.budget.percent > 100 ? 'h-full rounded-full bg-rose-400' : 'h-full rounded-full bg-brand-400'}
                    style={{ width: `${Math.min(100, summary.budget.percent)}%` }}
                  />
                </div>
                <p className="mt-2 text-[10px] text-white/35"><Money value={{ amountMinor: summary.budget.amountMinor, currency: summary.currency }} hide={hide} /> monthly limit</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => navigate({ to: '/track/budget', search: { month } })}
                className="min-h-[104px] rounded-[20px] border border-dashed border-white/15 bg-white/[0.04] px-4 text-left transition-colors hover:bg-white/[0.07]"
              >
                <p className="text-sm font-semibold text-white/82">Set a monthly budget</p>
                <p className="mt-1 text-xs leading-5 text-white/40">Optional. Useful only if you want a spending guardrail.</p>
              </button>
            )}
          </div>
        </div>
      </section>

      {showFilters && (
        <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
          <div className="glass-bar grid grid-cols-3 rounded-[18px] p-1 text-xs">
            {[{ key: undefined, label: 'All' }, { key: 'expense' as const, label: 'Expense' }, { key: 'income' as const, label: 'Income' }].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => changeType(option.key)}
                aria-pressed={type === option.key}
                className={type === option.key
                  ? 'min-h-9 rounded-[13px] bg-[#17171d] px-3 font-semibold text-white shadow-soft-xs dark:bg-white dark:text-slate-950'
                  : 'min-h-9 rounded-[13px] px-3 font-semibold text-slate-500 transition-colors hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'}
              >
                {option.label}
              </button>
            ))}
          </div>
          <label className="glass-bar flex min-w-0 items-center gap-2 rounded-[18px] px-3.5 py-2 text-sm focus-within:border-brand-400/60 focus-within:ring-4 focus-within:ring-brand-500/10">
            <Search size={15} className="shrink-0 text-slate-400" />
            <input type="search" placeholder="Search this month" value={text} onChange={(event) => setText(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400" aria-label="Search Track transactions" />
          </label>
        </div>
      )}

      {summary.byCategory.length > 0 && (
        <section>
          <div className="mb-3">
            <h2 className="section-title">Spending shape</h2>
            <p className="mt-1 text-xs text-slate-400">Tap a category to focus the transactions below.</p>
          </div>
          <Card><CategoryBreakdown rows={summary.byCategory} currency={summary.currency} totalMinor={summary.spentMinor} selectedCategoryId={selectedCategoryId} onSelectCategory={toggleCategory} /></Card>
        </section>
      )}

      <section>
        <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
          <div>
            <h2 className="section-title">Transactions</h2>
            {selectedCategoryName && <p className="mt-1 text-xs text-slate-400">Filtered to {selectedCategoryName}</p>}
          </div>
          {selectedCategoryName && <button type="button" onClick={() => setSelectedCategoryId(undefined)} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/30"><X size={14} /> Clear</button>}
        </div>
        <Card padded={false} className="overflow-hidden">
          {(monthTxs ?? []).length === 0 ? (
            <EmptyState title={selectedCategoryName ? `No ${selectedCategoryName.toLocaleLowerCase()} transactions` : 'No transactions this month'} description={selectedCategoryName ? 'Clear the category filter or add a transaction.' : 'Add your first one to start tracking.'} icon={<Wallet size={24} />} action={<Button onClick={() => onAdd('expense')}><Plus size={16} /> Add expense</Button>} />
          ) : (
            <ul className="stagger-list divide-y divide-slate-900/[0.055] dark:divide-white/[0.07]">{(monthTxs ?? []).map((transaction) => <li key={transaction.id}><TransactionListItem transaction={transaction} /></li>)}</ul>
          )}
        </Card>
      </section>

      <div className="grid grid-cols-2 gap-2.5">
        <Button onClick={() => onAdd('expense')} block size="lg"><Plus size={16} /> Expense</Button>
        <Button variant="secondary" onClick={() => onAdd('income')} block size="lg"><Plus size={16} /> Income</Button>
      </div>
      {!isCurrentMonth && <button type="button" onClick={() => navigate({ to: '/track' })} className="block w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-200">Jump to this month</button>}
    </div>
  );
}
