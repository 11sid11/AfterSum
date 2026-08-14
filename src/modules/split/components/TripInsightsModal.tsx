import { Modal, Money } from '@components/ui';
import type { Person, SplitExpense } from '@db/schema';
import { getSplitCategoryMeta } from '../domain/categories';

interface TripInsightsModalProps {
  open: boolean;
  onClose: () => void;
  currency: string;
  hideAmounts: boolean;
  expenses: SplitExpense[];
  payers: Array<{ expenseId: string; personId: string; amountMinor: number }>;
  shares: Array<{ expenseId: string; personId: string; amountMinor: number }>;
  people: Person[];
  selfPersonId: string;
}

export function TripInsightsModal({
  open,
  onClose,
  currency,
  hideAmounts,
  expenses,
  payers,
  shares,
  people,
  selfPersonId,
}: TripInsightsModalProps) {
  const activeIds = new Set(expenses.map((expense) => expense.id));
  const totalSpent = expenses.reduce((sum, expense) => sum + expense.amountMinor, 0);
  const yourShare = shares
    .filter((share) => activeIds.has(share.expenseId) && share.personId === selfPersonId)
    .reduce((sum, share) => sum + share.amountMinor, 0);

  const categoryTotals = new Map<string, number>();
  for (const expense of expenses) {
    const key = expense.category ?? 'other';
    categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + expense.amountMinor);
  }

  const payerTotals = new Map<string, number>();
  for (const payer of payers) {
    if (!activeIds.has(payer.expenseId)) continue;
    payerTotals.set(payer.personId, (payerTotals.get(payer.personId) ?? 0) + payer.amountMinor);
  }
  const peopleById = new Map(people.map((person) => [person.id, person]));

  const categories = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]);
  const paidBy = [...payerTotals.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <Modal open={open} onClose={onClose} title="Trip insights" className="max-w-lg">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Total spent" amountMinor={totalSpent} currency={currency} hide={hideAmounts} />
          <Metric label="Your share" amountMinor={yourShare} currency={currency} hide={hideAmounts} />
        </div>

        <section>
          <h3 className="section-title mb-2.5">By category</h3>
          {categories.length === 0 ? (
            <p className="text-sm text-slate-500">No expenses yet.</p>
          ) : (
            <div className="space-y-3">
              {categories.map(([category, amount]) => {
                const percent = totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0;
                return (
                  <div key={category}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">{getSplitCategoryMeta(category as never).label}</span>
                      <span className="shrink-0 tabular-nums">
                        <Money value={{ amountMinor: amount, currency }} hide={hideAmounts} />
                        <span className="ml-2 text-xs text-slate-400">{percent}%</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h3 className="section-title mb-2.5">Paid by</h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {paidBy.map(([personId, amount]) => {
              const person = peopleById.get(personId);
              return (
                <div key={personId} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="min-w-0 truncate font-medium">
                    {person?.isSelf ? 'You' : person?.name ?? 'Unknown'}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    <Money value={{ amountMinor: amount, currency }} hide={hideAmounts} />
                  </span>
                </div>
              );
            })}
            {paidBy.length === 0 && <p className="py-2 text-sm text-slate-500">No payments yet.</p>}
          </div>
        </section>
      </div>
    </Modal>
  );
}

function Metric({
  label,
  amountMinor,
  currency,
  hide,
}: {
  label: string;
  amountMinor: number;
  currency: string;
  hide: boolean;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
        <Money value={{ amountMinor, currency }} hide={hide} />
      </p>
    </div>
  );
}
