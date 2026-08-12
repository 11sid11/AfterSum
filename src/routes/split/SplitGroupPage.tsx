/**
 * Split group landing.
 *
 * Spec §41 layout:
 *   - Group spending
 *   - Your share
 *   - You paid
 *   - You're owed
 *   - Balances section (a few rows)
 *   - Expense list
 *   - "Add expense" FAB
 *
 * Links to balances / activity / settle / settings.
 */

import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { Money, MoneySigned, Spinner, Card, useToast } from '@components/ui';
import { Settings as SettingsIcon, Activity, Wallet, ArrowRightLeft, Plus } from 'lucide-react';
import { useSplitGroup, useSplitGroupSummary } from '@modules/split/queries';
import { usePeople, useSelf } from '@shared/people/queries';
import { useAppSettings } from '@shared/settings/useSettings';
import { splitExpenseRepository } from '@modules/split/repositories/splitExpenseRepository';
import { ExpenseListItem } from '@modules/split/components/ExpenseListItem';
import { splitPayerRepository } from '@modules/split/repositories/splitPayerRepository';
import { splitShareRepository } from '@modules/split/repositories/splitShareRepository';
import { UNDO_TIMEOUT_MS } from '@app/constants';

export function SplitGroupPage() {
  const params = useParams({ from: '/split/group/$groupId' });
  const groupId = params.groupId;
  const group = useSplitGroup(groupId);
  const summary = useSplitGroupSummary(groupId);
  const people = usePeople();
  const self = useSelf();
  const settings = useAppSettings();
  const hide = settings?.hideAmounts ?? false;
  const toast = useToast();
  const navigate = useNavigate();

  if (!group || !summary || !people || !self) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }
  if (group.deletedAt || group.archived) {
    return (
      <Card>
        <h1 className="text-base font-semibold">{group.name}</h1>
        <p className="mt-2 text-sm text-slate-500">
          This group is {group.archived ? 'archived' : 'deleted'}.
        </p>
        <Link to="/split" className="mt-3 inline-block text-sm text-brand-600 hover:underline">
          Back to all groups
        </Link>
      </Card>
    );
  }

  const personMap = new Map(people.map((p) => [p.id, p]));

  const handleDeleteExpense = async (expenseId: string, title: string) => {
    await splitExpenseRepository.softDelete(expenseId);
    toast.show(`"${title}" deleted`, {
      action: {
        label: 'Undo',
        onClick: () => {
          void splitExpenseRepository.restore(expenseId);
        },
      },
      duration: UNDO_TIMEOUT_MS,
    });
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{group.name}</h1>
          {group.description && (
            <p className="mt-0.5 text-sm text-slate-500">{group.description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate({ to: '/split/group/$groupId/settings', params: { groupId } })}
          aria-label="Group settings"
          className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <SettingsIcon size={18} />
        </button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-2">
        <SummaryTile
          label="Group spending"
          value={
            <Money value={{ amountMinor: summary.totalSpent, currency: group.currency }} hide={hide} />
          }
        />
        <SummaryTile
          label="Your share"
          value={
            <Money value={{ amountMinor: summary.yourShare, currency: group.currency }} hide={hide} />
          }
        />
        <SummaryTile
          label="You paid"
          value={
            <Money value={{ amountMinor: summary.youPaid, currency: group.currency }} hide={hide} />
          }
        />
        <SummaryTile
          label={summary.yourNet >= 0 ? "You're owed" : 'You owe'}
          value={
            <MoneySigned
              amountMinor={summary.yourNet}
              currency={group.currency}
              hide={hide}
            />
          }
        />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-2">
        <Link
          to="/split/group/$groupId/balances"
          params={{ groupId }}
          className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white p-3 text-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
        >
          <Wallet size={18} />
          Balances
        </Link>
        <Link
          to="/split/group/$groupId/activity"
          params={{ groupId }}
          className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white p-3 text-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
        >
          <Activity size={18} />
          Activity
        </Link>
        <Link
          to="/split/group/$groupId/settle"
          params={{ groupId }}
          className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white p-3 text-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
        >
          <ArrowRightLeft size={18} />
          Settle
        </Link>
      </div>

      {/* Balances preview */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Balances</h2>
          <Link
            to="/split/group/$groupId/balances"
            params={{ groupId }}
            className="text-xs text-brand-600 hover:underline"
          >
            See all
          </Link>
        </div>
        <ul className="space-y-1">
          {[...summary.balances.entries()]
            .filter(([pid]) => pid !== self.id)
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
            .slice(0, 3)
            .map(([pid, amount]) => {
              const person = personMap.get(pid);
              if (!person) return null;
              const label =
                amount > 0 ? `${person.name} owes you` : amount < 0 ? `You owe ${person.name}` : 'Settled';
              return (
                <li
                  key={pid}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <span>{label}</span>
                  <span
                    className={
                      amount > 0
                        ? 'font-semibold tabular-nums text-emerald-600'
                        : amount < 0
                          ? 'font-semibold tabular-nums text-rose-600'
                          : 'tabular-nums text-slate-500'
                    }
                  >
                    {amount === 0 ? (
                      '—'
                    ) : (
                      <Money
                        value={{ amountMinor: Math.abs(amount), currency: group.currency }}
                        hide={hide}
                      />
                    )}
                  </span>
                </li>
              );
            })}
          {[...summary.balances.entries()].filter(([pid]) => pid !== self.id).length === 0 && (
            <li className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              Add members and expenses to see balances.
            </li>
          )}
        </ul>
      </section>

      {/* Expense list */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Expenses</h2>
        {summary.recent.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            No expenses yet. Tap the + button to add one.
          </p>
        ) : (
          <ul className="space-y-2">
            {summary.recent.map((e) => (
              <div key={e.id} className="relative">
                <ExpenseListItem expense={e} />
                <button
                  type="button"
                  onClick={() => void handleDeleteExpense(e.id, e.title)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800"
                  aria-label={`Delete ${e.title}`}
                >
                  ×
                </button>
              </div>
            ))}
          </ul>
        )}
      </section>

      {/* Add expense FAB */}
      <button
        type="button"
        onClick={() =>
          navigate({ to: '/split/group/$groupId/add', params: { groupId }, search: { type: 'expense' } })
        }
        aria-label="Add expense"
        className="fixed bottom-20 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 hover:bg-brand-700 sm:bottom-6"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

// keep references live for typecheck
void splitPayerRepository;
void splitShareRepository;
