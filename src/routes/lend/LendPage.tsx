/** Lend dashboard. */

import { useNavigate } from '@tanstack/react-router';
import { ArrowDownLeft, ArrowUpRight, HandCoins, Plus, Users } from 'lucide-react';
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
  const netPositive = net > 0;
  const netNegative = net < 0;

  return (
    <div className="space-y-7">
      <header className="flex min-w-0 items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.65rem] font-semibold tracking-[-0.045em] text-slate-950 dark:text-white">Lend</h1>
          <p className="mt-1 text-xs text-slate-500">Direct money between you and another person.</p>
        </div>
        <Button size="sm" onClick={() => navigate({ to: '/lend/add' })} className="shrink-0"><Plus size={15} /> New entry</Button>
      </header>

      <Card className={netNegative
        ? 'overflow-hidden bg-gradient-to-b from-rose-50/80 to-white text-center dark:from-rose-400/[0.06] dark:to-[#141821]'
        : 'overflow-hidden bg-gradient-to-b from-emerald-50/80 to-white text-center dark:from-emerald-400/[0.06] dark:to-[#141821]'}>
        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">Total net position</p>
        <p className={netNegative
          ? 'mt-2 text-[2.65rem] font-semibold leading-none tracking-[-0.055em] tabular-nums text-rose-700 dark:text-rose-300'
          : 'mt-2 text-[2.65rem] font-semibold leading-none tracking-[-0.055em] tabular-nums text-emerald-700 dark:text-emerald-300'}>
          <Money value={{ amountMinor: Math.abs(net), currency }} hide={settings.hideAmounts} emphasize />
        </p>
        <div className={net === 0
          ? 'mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600 dark:bg-white/[0.055] dark:text-slate-300'
          : netPositive
            ? 'mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-400/[0.11] dark:text-emerald-300'
            : 'mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-[11px] font-medium text-rose-700 dark:bg-rose-400/[0.11] dark:text-rose-300'}>
          {netPositive ? <ArrowDownLeft size={13} /> : netNegative ? <ArrowUpRight size={13} /> : null}
          {net === 0 ? 'Everything settled' : netPositive ? 'To receive overall' : 'You owe overall'}
        </div>
      </Card>

      <section className="grid grid-cols-2 gap-3">
        <Card className="min-w-0">
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">You'll receive</p>
          <p className="mt-2 truncate text-[18px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
            <Money value={{ amountMinor: youWillReceive, currency }} hide={settings.hideAmounts} emphasize />
          </p>
        </Card>
        <Card className="min-w-0">
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">You owe</p>
          <p className="mt-2 truncate text-[18px] font-semibold tabular-nums text-rose-700 dark:text-rose-300">
            <Money value={{ amountMinor: youOwe, currency }} hide={settings.hideAmounts} emphasize />
          </p>
        </Card>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-[-0.02em]">Balances</h2>
            <p className="mt-1 text-xs text-slate-500">Each person stays independent from Split.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate({ to: '/settings/people' })}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/[0.06] dark:hover:text-white"
          >
            <Users size={14} /> Manage people
          </button>
        </div>
        {!hasAnyActivity ? (
          <Card>
            <EmptyState
              title="No Lend activity yet"
              description="Add an entry, then choose an existing person or create them without leaving the form."
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
