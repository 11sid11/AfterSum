import { useMemo, useState } from 'react';
import { ChevronDown, Plus, ReceiptText, Search, X } from 'lucide-react';
import { Button, Card, EmptyState, Input, Money } from '@components/ui';
import type { Person, SplitExpense } from '@db/schema';
import { formatHumanDate } from '@shared/dates';
import { getSplitCategoryMeta } from '../domain/categories';
import { SplitCategoryIcon } from './SplitCategoryIcon';

interface TripExpensesPanelProps {
  expenses: SplitExpense[];
  currency: string;
  hideAmounts: boolean;
  people: Person[];
  payers: Array<{ expenseId: string; personId: string }>;
  shares: Array<{ expenseId: string; personId: string }>;
  onDelete: (expense: SplitExpense) => Promise<void>;
  onAdd: () => void;
}

export function TripExpensesPanel({
  expenses,
  currency,
  hideAmounts,
  people,
  payers,
  shares,
  onDelete,
  onAdd,
}: TripExpensesPanelProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const personMap = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const activeExpenseIds = useMemo(() => new Set(expenses.map((expense) => expense.id)), [expenses]);

  const expensePayers = useMemo(() => {
    const map = new Map<string, string>();
    for (const payer of payers) {
      if (activeExpenseIds.has(payer.expenseId) && !map.has(payer.expenseId)) {
        map.set(payer.expenseId, payer.personId);
      }
    }
    return map;
  }, [activeExpenseIds, payers]);

  const participantNames = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const share of shares) {
      if (!activeExpenseIds.has(share.expenseId)) continue;
      const list = map.get(share.expenseId) ?? [];
      const person = personMap.get(share.personId);
      if (person) list.push(person.isSelf ? 'You' : person.name);
      map.set(share.expenseId, list);
    }
    return map;
  }, [activeExpenseIds, personMap, shares]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return expenses;
    return expenses.filter((expense) => {
      const payer = personMap.get(expensePayers.get(expense.id) ?? '');
      const haystack = [
        expense.title,
        expense.note ?? '',
        getSplitCategoryMeta(expense.category).label,
        payer?.name ?? '',
        ...(participantNames.get(expense.id) ?? []),
      ]
        .join(' ')
        .toLocaleLowerCase();
      return haystack.includes(needle);
    });
  }, [expensePayers, expenses, participantNames, personMap, query]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title">Expenses</h2>
        <button
          type="button"
          onClick={() => {
            setSearchOpen((value) => !value);
            setQuery('');
          }}
          className="icon-button shrink-0"
          aria-label={searchOpen ? 'Close expense search' : 'Search expenses'}
        >
          {searchOpen ? <X size={17} /> : <Search size={17} />}
        </button>
      </div>

      {searchOpen && (
        <>
          <Input
            label="Search this trip"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Dinner, Rahul, food…"
            autoFocus
          />
          <p className="text-xs text-slate-500">{filtered.length} result{filtered.length === 1 ? '' : 's'}</p>
        </>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={searchOpen ? undefined : <ReceiptText size={32} />}
          title={searchOpen ? 'No matching expenses' : 'No expenses yet'}
          description={
            searchOpen
              ? 'Try a title, category or participant name.'
              : 'Add your first shared cost. For a normal expense, title and amount are enough.'
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((expense) => (
            <TripExpenseCard
              key={expense.id}
              expense={expense}
              currency={currency}
              hide={hideAmounts}
              payer={personMap.get(expensePayers.get(expense.id) ?? '')}
              participants={participantNames.get(expense.id) ?? []}
              onDelete={searchOpen ? undefined : () => void onDelete(expense)}
            />
          ))}
        </div>
      )}

      {!searchOpen && (
        <button
          type="button"
          onClick={onAdd}
          className="fixed bottom-24 right-4 z-30 flex h-14 items-center gap-2 rounded-full bg-brand-600 px-5 font-semibold text-white shadow-lg shadow-brand-600/30 hover:bg-brand-700 sm:bottom-6 sm:right-6"
          aria-label="Add expense"
        >
          <Plus size={21} /> Expense
        </button>
      )}
    </section>
  );
}

function TripExpenseCard({
  expense,
  currency,
  hide,
  payer,
  participants,
  onDelete,
}: {
  expense: SplitExpense;
  currency: string;
  hide: boolean;
  payer?: Person;
  participants: string[];
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const category = getSplitCategoryMeta(expense.category);
  const methodLabel = expense.items?.length
    ? 'Itemized'
    : expense.splitMethod === 'equal'
      ? 'Equal'
      : expense.splitMethod === 'exact'
        ? 'Exact'
        : expense.splitMethod === 'percentage'
          ? 'Percent'
          : 'Shares';

  return (
    <Card padded={false}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">
          <SplitCategoryIcon category={expense.category} size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{expense.title}</span>
          <span className="block truncate text-xs text-slate-500">
            Paid by {payer?.isSelf ? 'You' : payer?.name ?? 'Unknown'} · {category.label}
            {expense.recurrenceTemplateId ? ' · Recurring' : ''}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block max-w-28 truncate text-sm font-semibold tabular-nums min-[380px]:max-w-none">
            <Money value={{ amountMinor: expense.amountMinor, currency }} hide={hide} />
          </span>
          <ChevronDown
            size={16}
            className={
              open
                ? 'ml-auto mt-1 rotate-180 text-slate-400 transition-transform'
                : 'ml-auto mt-1 text-slate-400 transition-transform'
            }
          />
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Detail label="People" value={String(participants.length)} />
            <Detail label="Split" value={methodLabel} />
            <Detail label="Date" value={formatHumanDate(expense.date)} />
          </div>

          {participants.length > 0 && (
            <p className="break-words text-xs text-slate-500">Split with {participants.join(', ')}</p>
          )}

          {expense.originalCurrency && expense.originalAmountMinor !== undefined && (
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              Originally paid{' '}
              <strong>
                <Money
                  value={{ amountMinor: expense.originalAmountMinor, currency: expense.originalCurrency }}
                  hide={hide}
                />
              </strong>
              {expense.exchangeRate ? ` · rate ${expense.exchangeRate}` : ''}
            </div>
          )}

          {expense.items && expense.items.length > 0 && (
            <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
              <p className="text-xs font-semibold">{expense.items.length} item{expense.items.length === 1 ? '' : 's'}</p>
              <ul className="mt-2 space-y-1.5">
                {expense.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate text-slate-500">{item.title}</span>
                    <span className="shrink-0 font-medium tabular-nums">
                      <Money value={{ amountMinor: item.amountMinor, currency }} hide={hide} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {expense.note && (
            <div className="break-words rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              {expense.note}
            </div>
          )}

          {onDelete && (
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" className="text-rose-600" onClick={onDelete}>
                Delete expense
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 px-1 py-2 dark:bg-slate-800/60 min-[380px]:px-2">
      <p className="truncate text-[9px] uppercase tracking-wide text-slate-400 min-[380px]:text-[10px]">{label}</p>
      <p className="mt-0.5 truncate text-[11px] font-semibold min-[380px]:text-xs">{value}</p>
    </div>
  );
}
