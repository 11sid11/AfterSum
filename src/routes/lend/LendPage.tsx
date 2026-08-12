/**
 * Lend dashboard.
 *
 * Work.md §26: top of the page is the summary card
 * ("You'll receive" / "You owe"). Below is the per-person
 * list with `Owes you` / `You owe` / `Settled` labels.
 *
 * The "Add" button routes to /lend/add. The "Add" menu in
 * the global FAB also surfaces a "Lent money" / "Borrowed
 * money" shortcut (work.md §48).
 */

import { Link, useNavigate } from '@tanstack/react-router';
import { Plus, HandCoins } from 'lucide-react';
import { Card, Money, Spinner } from '@components/ui';
import { useAppSettings } from '@shared/settings/useSettings';
import { useLendDashboard } from '@modules/lend/queries';
import { LendPersonCard } from '@modules/lend/components/LendPersonCard';
import { EmptyState } from '@components/ui';

export function LendPage() {
  const settings = useAppSettings();
  const navigate = useNavigate();
  const dashboard = useLendDashboard();

  if (!settings || !dashboard) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner />
      </div>
    );
  }

  const currency = settings.defaultCurrency;
  const { youWillReceive, youOwe, people } = dashboard;
  const hasAnyActivity = people.length > 0;
  const net = youWillReceive - youOwe;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Lend</h1>
          <p className="text-xs text-slate-500">Direct person-to-person money</p>
        </div>
        <Link
          to="/lend/add"
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          <Plus size={16} />
          Add
        </Link>
      </header>

      <Card>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">You'll receive</p>
            <p className="mt-1 text-xl font-semibold text-emerald-600">
              <Money
                value={{ amountMinor: youWillReceive, currency }}
                hide={settings.hideAmounts}
                emphasize
              />
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">You owe</p>
            <p className="mt-1 text-xl font-semibold text-rose-600">
              <Money
                value={{ amountMinor: youOwe, currency }}
                hide={settings.hideAmounts}
                emphasize
              />
            </p>
          </div>
        </div>
        {hasAnyActivity && net !== 0 && (
          <p className="mt-3 text-xs text-slate-500">
            Net:{' '}
            <strong>
              <Money
                value={{ amountMinor: Math.abs(net), currency }}
                hide={settings.hideAmounts}
              />
            </strong>{' '}
            {net > 0 ? 'in your favor' : 'against you'}
          </p>
        )}
      </Card>

      {!hasAnyActivity ? (
        <Card>
          <EmptyState
            title="No Lend activity yet"
            description="Track money you've lent to or borrowed from people you know."
            icon={<HandCoins size={36} className="text-slate-300" />}
            action={
              <button
                type="button"
                onClick={() => navigate({ to: '/lend/add' })}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
              >
                <Plus size={16} />
                Add first entry
              </button>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-2">
          {people.map((row) => (
            <li key={row.person.id}>
              <LendPersonCard summary={row} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
