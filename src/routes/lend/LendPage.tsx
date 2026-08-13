/** Lend dashboard. */

import { Link, useNavigate } from '@tanstack/react-router';
import { Plus, HandCoins, TrendingUp, TrendingDown } from 'lucide-react';
import { Button, Card, Money, Spinner, EmptyState } from '@components/ui';
import { useAppSettings } from '@shared/settings/useSettings';
import { useLendDashboard } from '@modules/lend/queries';
import { LendPersonCard } from '@modules/lend/components/LendPersonCard';

export function LendPage() {
  const settings = useAppSettings();
  const navigate = useNavigate();
  const dashboard = useLendDashboard();

  if (!settings || !dashboard) {
    return <div className="grid min-h-[40vh] place-items-center"><Spinner /></div>;
  }

  const currency = settings.defaultCurrency;
  const { youWillReceive, youOwe, people } = dashboard;
  const hasAnyActivity = people.length > 0;
  const net = youWillReceive - youOwe;

  return (
    <div className="space-y-6">
      <header className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="page-title">Lend</h1>
          <p className="page-subtitle">Keep personal lending simple and separate from shared trips.</p>
        </div>
        <Button size="sm" onClick={() => navigate({ to: '/lend/add' })} className="shrink-0"><Plus size={16} /> Add</Button>
      </header>

      <Card className="bg-gradient-to-br from-white via-white to-slate-50/80 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="rounded-2xl bg-emerald-50/70 p-3.5 dark:bg-emerald-950/20 sm:p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700/80 dark:text-emerald-300/80"><TrendingUp size={15} /> You'll receive</div>
            <p className="mt-2 truncate text-2xl font-semibold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-300">
              <Money value={{ amountMinor: youWillReceive, currency }} hide={settings.hideAmounts} emphasize />
            </p>
          </div>
          <div className="rounded-2xl bg-rose-50/70 p-3.5 dark:bg-rose-950/20 sm:p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-rose-700/80 dark:text-rose-300/80"><TrendingDown size={15} /> You owe</div>
            <p className="mt-2 truncate text-2xl font-semibold tracking-tight tabular-nums text-rose-600 dark:text-rose-300">
              <Money value={{ amountMinor: youOwe, currency }} hide={settings.hideAmounts} emphasize />
            </p>
          </div>
        </div>
        {hasAnyActivity && net !== 0 && (
          <div className="mt-3 rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/20 dark:text-slate-400">
            Net position: <strong className="font-semibold text-slate-800 dark:text-slate-200"><Money value={{ amountMinor: Math.abs(net), currency }} hide={settings.hideAmounts} /></strong> {net > 0 ? 'in your favor' : 'against you'}
          </div>
        )}
      </Card>

      <section>
        <h2 className="section-title mb-2.5">People</h2>
        {!hasAnyActivity ? (
          <Card>
            <EmptyState
              title="No Lend activity yet"
              description="Track money you've lent to or borrowed from people you know."
              icon={<HandCoins size={26} />}
              action={<Button onClick={() => navigate({ to: '/lend/add' })}><Plus size={16} /> Add first entry</Button>}
            />
          </Card>
        ) : (
          <ul className="space-y-2.5">
            {people.map((row) => <li key={row.person.id}><LendPersonCard summary={row} /></li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
