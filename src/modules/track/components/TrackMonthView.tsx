/** Shared view for a single month of Track data. */

import { useNavigate } from '@tanstack/react-router';
import { ArrowUpRight, Plus, Search, Tags, Wallet, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Card, Button, Money, EmptyState, Spinner } from '@components/ui';
import { useAppSettings } from '@shared/settings/useSettings';
import { useTrackMonthlySummary, useTrackTransactionsForMonth } from '../queries';
import { toMonthKey } from '@shared/dates';
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

  const currentMonth = toMonthKey();
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
    <div className="space-y-7">
      <header className="flex min-w-0 items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.65rem] font-semibold tracking-[-0.045em] text-slate-950 dark:text-white">Track</h1>
          <p className="mt-1 text-xs text-slate-500">Everyday income and spending.</p>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <button type="button" onClick={() => navigate({ to: '/track/categories' })} aria-label="Manage categories" className="icon-button"><Tags size={17} /></button>
          <button type="button" onClick={() => navigate({ to: '/track/budget', search: { month } })} aria-label="Monthly budget" className="icon-button"><Wallet size={17} /></button>
        </div>
      </header>

      <div className="mx-auto max-w-sm"><MonthNavigator month={month} disableNextIfCurrent currentMonth={currentMonth} /></div>

      <Card className="overflow-hidden bg-gradient-to-br from-white via-white to-[#fff4f0] dark:from-[#141821] dark:via-[#141821] dark:to-[#211714]">
        <div className="grid gap-5 sm:grid-cols-[1.2fr_0.8fr] sm:items-end">
          <div>
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">Total spent</p>
            <p className="mt-2 text-[2.55rem] font-semibold leading-none tracking-[-0.055em] tabular-nums text-slate-950 dark:text-white sm:text-[3rem]">
              <Money value={{ amountMinor: summary.spentMinor, currency: summary.currency }} hide={hide} emphasize />
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-400/[0.09] dark:text-emerald-300">
              <ArrowUpRight size={13} />
              Income <span className="font-semibold tabular-nums"><Money value={{ amountMinor: summary.incomeMinor, currency: summary.currency }} hide={hide} /></span>
            </div>
          </div>

          {summary.budget ? (
            <div className="rounded-[15px] border border-slate-200/80 bg-white/75 p-3.5 dark:border-white/[0.07] dark:bg-white/[0.035]">
              <div className="flex items-end justify-between gap-3">
                <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">Monthly budget</p>
                <p className="text-xs font-semibold tabular-nums text-slate-800 dark:text-slate-200"><Money value={{ amountMinor: summary.budget.amountMinor, currency: summary.currency }} hide={hide} /></p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/[0.08]">
                <div
                  className={summary.budget.percent > 100 ? 'h-full rounded-full bg-rose-500 transition-[width] duration-500' : 'h-full rounded-full bg-[#fd876f] transition-[width] duration-500'}
                  style={{ width: `${Math.min(100, summary.budget.percent)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[10px]">
                <span className="text-slate-500">{summary.budget.percent}% used</span>
                <span className={summary.budget.remainingMinor >= 0 ? 'font-medium text-[#a54431] dark:text-rose-300' : 'font-medium text-rose-600 dark:text-rose-300'}>
                  {summary.budget.remainingMinor >= 0
                    ? <><Money value={{ amountMinor: summary.budget.remainingMinor, currency: summary.currency }} hide={hide} /> remaining</>
                    : <>Over by <Money value={{ amountMinor: Math.abs(summary.budget.remainingMinor), currency: summary.currency }} hide={hide} /></>}
                </span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => navigate({ to: '/track/budget', search: { month } })}
              className="min-h-[92px] rounded-[15px] border border-dashed border-slate-300 bg-white/[0.55] px-3.5 text-left transition-colors hover:bg-white dark:border-white/[0.12] dark:bg-white/[0.025] dark:hover:bg-white/[0.05]"
            >
              <p className="text-sm font-semibold">Set a monthly budget</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Optional spending guardrail.</p>
            </button>
          )}
        </div>
      </Card>

      {showFilters && (
        <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[{ key: undefined, label: 'All' }, { key: 'expense' as const, label: 'Expense' }, { key: 'income' as const, label: 'Income' }].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => changeType(option.key)}
                aria-pressed={type === option.key}
                className={type === option.key
                  ? 'min-h-9 shrink-0 rounded-full bg-slate-950 px-4 text-xs font-semibold text-white shadow-[0_2px_6px_rgb(15_23_42/0.12)] dark:bg-white dark:text-slate-950'
                  : 'min-h-9 shrink-0 rounded-full border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-950 dark:border-white/[0.075] dark:bg-[#141821] dark:text-slate-400 dark:hover:text-white'}
              >
                {option.label}
              </button>
            ))}
          </div>
          <label className="flex min-h-10 min-w-0 items-center gap-2 rounded-[13px] border border-slate-200/[0.85] bg-white px-3.5 text-sm shadow-[0_1px_2px_rgb(15_23_42/0.025)] focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/[0.08] dark:border-white/[0.075] dark:bg-[#141821]">
            <Search size={15} className="shrink-0 text-slate-400" />
            <input type="search" placeholder="Search transactions…" value={text} onChange={(event) => setText(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400" aria-label="Search Track transactions" />
          </label>
        </div>
      )}

      {summary.byCategory.length > 0 && (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold tracking-[-0.02em]">Top categories</h2>
              <p className="mt-1 text-xs text-slate-500">Tap a category to filter transactions.</p>
            </div>
          </div>
          <CategoryBreakdown rows={summary.byCategory} currency={summary.currency} totalMinor={summary.spentMinor} selectedCategoryId={selectedCategoryId} onSelectCategory={toggleCategory} />
        </section>
      )}

      <section>
        <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-[-0.02em]">Recent transactions</h2>
            {selectedCategoryName && <p className="mt-1 text-xs text-slate-500">Filtered to {selectedCategoryName}</p>}
          </div>
          {selectedCategoryName && <button type="button" onClick={() => setSelectedCategoryId(undefined)} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/30"><X size={14} /> Clear</button>}
        </div>
        <Card padded={false} className="overflow-hidden">
          {(monthTxs ?? []).length === 0 ? (
            <EmptyState title={selectedCategoryName ? `No ${selectedCategoryName.toLocaleLowerCase()} transactions` : 'No transactions this month'} description={selectedCategoryName ? 'Clear the category filter or add a transaction.' : 'Add your first one to start tracking.'} icon={<Wallet size={24} />} action={<Button onClick={() => onAdd('expense')}><Plus size={16} /> Add expense</Button>} />
          ) : (
            <ul className="stagger-list divide-y divide-slate-200/75 dark:divide-white/[0.07]">{(monthTxs ?? []).map((transaction) => <li key={transaction.id}><TransactionListItem transaction={transaction} /></li>)}</ul>
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
