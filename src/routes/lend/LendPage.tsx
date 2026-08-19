/** Lend dashboard. */

import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { HandCoins, Plus, Users } from 'lucide-react';
import { Button, Card, EmptyState, Money, Spinner } from '@components/ui';
import { useAppSettings } from '@shared/settings/useSettings';
import { useLendDashboard } from '@modules/lend/queries';
import { AddLendPersonModal } from '@modules/lend/components/AddLendPersonModal';
import { LendPersonCard } from '@modules/lend/components/LendPersonCard';

export function LendPage() {
  const settings = useAppSettings();
  const navigate = useNavigate();
  const dashboard = useLendDashboard();
  const [addPersonOpen, setAddPersonOpen] = useState(false);

  if (!settings || !dashboard) {
    return <div className="grid min-h-[40vh] place-items-center"><Spinner /></div>;
  }

  const currency = settings.defaultCurrency;
  const { youWillReceive, youOwe, people } = dashboard;
  const hasLendPeople = people.length > 0;

  return (
    <div className="space-y-7">
      <header className="flex min-w-0 items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.65rem] font-semibold tracking-[-0.045em] text-slate-950 dark:text-white">Lend</h1>
          <p className="mt-1 text-xs text-slate-500">Simple balances between you and people you know.</p>
        </div>
        <Button size="sm" onClick={() => setAddPersonOpen(true)} className="shrink-0">
          <Plus size={15} /> Add person
        </Button>
      </header>

      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-2 divide-x divide-slate-900/[0.06] dark:divide-white/[0.07]">
          <div className="min-w-0 px-4 py-4 text-center sm:px-5">
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">You'll receive</p>
            <p className="mt-2 truncate text-[20px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
              <Money value={{ amountMinor: youWillReceive, currency }} hide={settings.hideAmounts} emphasize />
            </p>
          </div>
          <div className="min-w-0 px-4 py-4 text-center sm:px-5">
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">You owe</p>
            <p className="mt-2 truncate text-[20px] font-semibold tabular-nums text-rose-700 dark:text-rose-300">
              <Money value={{ amountMinor: youOwe, currency }} hide={settings.hideAmounts} emphasize />
            </p>
          </div>
        </div>
      </Card>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-[-0.02em]">People</h2>
            <p className="mt-1 text-xs text-slate-500">Tap a person to see their running ledger.</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: '/settings/people' })}
            className="shrink-0"
          >
            <Users size={14} /> Manage
          </Button>
        </div>

        {!hasLendPeople ? (
          <Card>
            <EmptyState
              title="No people in Lend yet"
              description="Add someone once, then record money with two simple actions: You gave or You got."
              icon={<HandCoins size={26} />}
              action={
                <Button onClick={() => setAddPersonOpen(true)}>
                  <Plus size={16} /> Add first person
                </Button>
              }
            />
          </Card>
        ) : (
          <ul className="stagger-list space-y-2.5">
            {people.map((row) => <li key={row.person.id}><LendPersonCard summary={row} /></li>)}
          </ul>
        )}
      </section>

      <AddLendPersonModal
        open={addPersonOpen}
        onClose={() => setAddPersonOpen(false)}
        onOpenPerson={(personId) => navigate({ to: '/lend/person/$personId', params: { personId } })}
      />
    </div>
  );
}
