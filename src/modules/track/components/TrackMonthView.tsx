/** Shared view for a single month of Track data. */

import { useNavigate } from '@tanstack/react-router';
import { Plus, Tags, Wallet, Search, X } from 'lucide-react';
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
    <div className="space-y-6">
      <header className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="page-title">Track</h1>
          <p className="page-subtitle">Everyday income and spending, organized month by month.</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={() => navigate({ to: '/track/categories' })} aria-label="Manage categories" className="icon-button"><Tags size={18} /></button>
          <button type="button" onClick={() => navigate({ to: '/track/budget', search: { month } })} aria-label="Monthly budget" className="icon-button"><Wallet size={18} /></button>
        </div>
      </header>

      <MonthNavigator month={month} disableNextIfCurrent currentMonth={currentMonth} />

      <Card className="bg-gradient-to-br from-white via-white to-slate-50/80 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Spent" tone="expense"><Money value={{ amountMinor: summary.spentMinor, currency: summary.currency }} hide={hide} /></Metric>
          <Metric label="Income" tone="income"><Money value={{ amountMinor: summary.incomeMinor, currency: summary.currency }} hide={hide} /></Metric>
          {summary.budget ? (
            <div className="col-span-2 rounded-2xl border border-slate-200/70 bg-white/75 p-4 dark:border-slate-800 dark:bg-slate-950/20">
              <div className="flex items-center justify-between gap-3 text-sm">
                <div><p className="font-semibold">Monthly budget</p><p className="mt-0.5 text-xs text-slate-500"><Money value={{ amountMinor: summary.budget.amountMinor, currency: summary.currency }} hide={hide} /> total</p></div>
                <p className={summary.budget.remainingMinor >= 0 ? 'font-semibold text-slate-700 dark:text-slate-200' : 'font-semibold text-rose-600 dark:text-rose-300'}>
                  {summary.budget.remainingMinor >= 0 ? <><Money value={{ amountMinor: summary.budget.remainingMinor, currency: summary.currency }} hide={hide} /> left</> : <>Over by <Money value={{ amountMinor: Math.abs(summary.budget.remainingMinor), currency: summary.currency }} hide={hide} /></>}
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={summary.budget.percent > 100 ? 'h-full rounded-full bg-rose-500' : 'h-full rounded-full bg-brand-500'} style={{ width: `${Math.min(100, summary.budget.percent)}%` }} /></div>
              <p className="mt-2 text-xs text-slate-400">{summary.budget.percent}% used</p>
            </div>
          ) : (
            <button type="button" onClick={() => navigate({ to: '/track/budget', search: { month } })} className="col-span-2 min-h-11 rounded-2xl border border-dashed border-slate-300 text-sm font-medium text-slate-500 hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700 dark:border-slate-700 dark:hover:border-brand-800 dark:hover:bg-brand-950/20 dark:hover:text-brand-300">Set a monthly budget</button>
          )}
        </div>
      </Card>

      {showFilters && (
        <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
          <div className="grid grid-cols-3 rounded-2xl border border-slate-200/80 bg-white/90 p-1 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
            {[{ key: undefined, label: 'All' }, { key: 'expense' as const, label: 'Expense' }, { key: 'income' as const, label: 'Income' }].map((option) => (
              <button key={option.label} type="button" onClick={() => changeType(option.key)} aria-pressed={type === option.key} className={type === option.key ? 'min-h-9 rounded-xl bg-slate-900 px-3 font-semibold text-white shadow-sm dark:bg-slate-100 dark:text-slate-900' : 'min-h-9 rounded-xl px-3 font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}>{option.label}</button>
            ))}
          </div>
          <label className="flex min-w-0 items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/90 px-3.5 py-2 text-sm shadow-sm focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/10 dark:border-slate-800 dark:bg-slate-900/90">
            <Search size={15} className="shrink-0 text-slate-400" />
            <input type="search" placeholder="Search this month" value={text} onChange={(event) => setText(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400" aria-label="Search Track transactions" />
          </label>
        </div>
      )}

      {summary.byCategory.length > 0 && (
        <section>
          <div className="mb-2.5"><h2 className="section-title">By category</h2><p className="mt-1 text-xs text-slate-400">Tap a category to filter the transactions below.</p></div>
          <Card><CategoryBreakdown rows={summary.byCategory} currency={summary.currency} totalMinor={summary.spentMinor} selectedCategoryId={selectedCategoryId} onSelectCategory={toggleCategory} /></Card>
        </section>
      )}

      <section>
        <div className="mb-2.5 flex min-w-0 items-center justify-between gap-3">
          <h2 className="section-title min-w-0 truncate">Transactions{selectedCategoryName ? ` · ${selectedCategoryName}` : ''}</h2>
          {selectedCategoryName && <button type="button" onClick={() => setSelectedCategoryId(undefined)} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/30"><X size={14} /> Clear</button>}
        </div>
        <Card padded={false} className="overflow-hidden">
          {(monthTxs ?? []).length === 0 ? (
            <EmptyState title={selectedCategoryName ? `No ${selectedCategoryName.toLocaleLowerCase()} transactions` : 'No transactions this month'} description={selectedCategoryName ? 'Clear the category filter or add a transaction.' : 'Add your first one to start tracking.'} icon={<Wallet size={24} />} action={<Button onClick={() => onAdd('expense')}><Plus size={16} /> Add expense</Button>} />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">{(monthTxs ?? []).map((transaction) => <li key={transaction.id}><TransactionListItem transaction={transaction} /></li>)}</ul>
          )}
        </Card>
      </section>

      <div className="grid grid-cols-2 gap-2.5"><Button onClick={() => onAdd('expense')} block><Plus size={16} /> Expense</Button><Button variant="secondary" onClick={() => onAdd('income')} block><Plus size={16} /> Income</Button></div>
      {!isCurrentMonth && <button type="button" onClick={() => navigate({ to: '/track' })} className="block w-full text-center text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-200">Jump to this month</button>}
    </div>
  );
}

function Metric({ label, tone, children }: { label: string; tone: 'expense' | 'income'; children: React.ReactNode }) {
  const className = tone === 'expense'
    ? 'bg-rose-50/70 text-rose-600 dark:bg-rose-950/20 dark:text-rose-300'
    : 'bg-emerald-50/70 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-300';
  return <div className={`min-w-0 rounded-2xl p-3.5 sm:p-4 ${className}`}><p className="text-xs font-medium opacity-80">{label}</p><p className="mt-2 truncate text-2xl font-semibold tracking-tight tabular-nums">{children}</p></div>;
}
