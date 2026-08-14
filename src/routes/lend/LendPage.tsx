/** Lend dashboard. */

import { useNavigate } from '@tanstack/react-router';
import { ArrowDownLeft, ArrowUpRight, HandCoins, Plus } from 'lucide-react';
import { Button, Card, EmptyState, Money, Spinner } from '@components/ui';
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
    <div className="space-y-8">
      <header className="flex min-w-0 items-end justify-between gap-4">
        <div className="min-w-0">
          <span className="module-chip mb-3"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Lend</span>
          <h1 className="page-title">Personal IOUs, without the mental math.</h1>
          <p className="page-subtitle">One clear ledger per person. Repayments change the balance; nothing else does.</p>
        </div>
        <Button size="sm" onClick={() => navigate({ to: '/lend/add' })} className="shrink-0"><Plus size={15} /> Add</Button>
      </header>

      <section className="hero-panel px-5 py-5 sm:px-7 sm:py-7">
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="hero-kicker"><HandCoins size={12} /> Net position</span>
              <p className="mt-3 text-[2.3rem] font-semibold leading-none tracking-[-0.055em] tabular-nums sm:text-[3rem]">
                <Money value={{ amountMinor: Math.abs(net), currency }} hide={settings.hideAmounts} emphasize />
              </p>
              <p className="mt-2 text-xs text-white/45">{net === 0 ? 'Everything is balanced.' : net > 0 ? 'In your favor across Lend.' : 'You currently owe more than you are owed.'}</p>
            </div>
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[16px] border border-white/10 bg-emerald-400/10 text-emerald-300">
              {net >= 0 ? <ArrowDownLeft size={19} /> : <ArrowUpRight size={19} />}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2">
            <div className="rounded-[19px] border border-white/10 bg-white/[0.055] px-3.5 py-3 backdrop-blur">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/38">You'll receive</p>
              <p className="mt-1 truncate text-[16px] font-semibold tabular-nums text-emerald-300">
                <Money value={{ amountMinor: youWillReceive, currency }} hide={settings.hideAmounts} emphasize />
              </p>
            </div>
            <div className="rounded-[19px] border border-white/10 bg-white/[0.055] px-3.5 py-3 backdrop-blur">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/38">You owe</p>
              <p className="mt-1 truncate text-[16px] font-semibold tabular-nums text-rose-300">
                <Money value={{ amountMinor: youOwe, currency }} hide={settings.hideAmounts} emphasize />
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="section-title">People</h2>
          <p className="mt-1 text-xs text-slate-400">Each person stays separate, even if other modules also involve them.</p>
        </div>
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
          <ul className="stagger-list space-y-2.5">
            {people.map((row) => <li key={row.person.id}><LendPersonCard summary={row} /></li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
