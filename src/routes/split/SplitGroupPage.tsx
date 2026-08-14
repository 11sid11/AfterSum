import { useEffect, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, ArrowUpRight, ReceiptText, Settings as SettingsIcon, Users, WalletCards } from 'lucide-react';
import { Button, Card, Money, Spinner, useToast } from '@components/ui';
import {
  useSplitGroup,
  useSplitGroupBalances,
  useSplitGroupRaw,
  useSplitGroupSummary,
} from '@modules/split/queries';
import { usePeople, useSelf } from '@shared/people/queries';
import { useAppSettings } from '@shared/settings/useSettings';
import { splitExpenseRepository } from '@modules/split/repositories/splitExpenseRepository';
import { TripBalancesPanel } from '@modules/split/components/TripBalancesPanel';
import { TripExpensesPanel } from '@modules/split/components/TripExpensesPanel';
import { TripInsightsModal } from '@modules/split/components/TripInsightsModal';
import { TripPeoplePanel } from '@modules/split/components/TripPeoplePanel';
import { materializeDueSplitRecurring } from '@modules/split/services/recurring';
import { UNDO_TIMEOUT_MS } from '@app/constants';
import type { SplitExpense } from '@db/schema';

type TripTab = 'expenses' | 'balances' | 'people';

const TABS: Array<{ value: TripTab; label: string; icon: typeof ReceiptText }> = [
  { value: 'expenses', label: 'Expenses', icon: ReceiptText },
  { value: 'balances', label: 'Balances', icon: WalletCards },
  { value: 'people', label: 'People', icon: Users },
];

export function SplitGroupPage() {
  const { groupId } = useParams({ from: '/split/group/$groupId' });
  const navigate = useNavigate();
  const group = useSplitGroup(groupId);
  const summary = useSplitGroupSummary(groupId);
  const raw = useSplitGroupRaw(groupId);
  const balanceResult = useSplitGroupBalances(groupId);
  const people = usePeople();
  const self = useSelf();
  const settings = useAppSettings();
  const toast = useToast();
  const [tab, setTab] = useState<TripTab>('expenses');
  const [insightsOpen, setInsightsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void materializeDueSplitRecurring(groupId)
      .then((result) => {
        if (cancelled) return;
        if (result.created > 0) {
          toast.show(
            `${result.created} recurring expense${result.created === 1 ? '' : 's'} added`,
            { variant: 'success' },
          );
        }
        if (result.blocked > 0) {
          toast.show(
            `${result.blocked} recurring expense${result.blocked === 1 ? '' : 's'} need${result.blocked === 1 ? 's' : ''} attention because trip participants changed.`,
          );
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast.show(error instanceof Error ? error.message : 'Could not update recurring expenses', {
            variant: 'error',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [groupId, toast]);

  if (!group || !summary || !raw || !balanceResult || !people || !self || !settings) {
    return <div className="flex justify-center py-10"><Spinner /></div>;
  }

  if (group.deletedAt || group.archived) {
    return (
      <Card>
        <h1 className="truncate text-base font-semibold">{group.name}</h1>
        <p className="mt-2 text-sm text-slate-500">
          This trip is {group.archived ? 'archived' : 'deleted'}.
        </p>
        <Button className="mt-3" variant="secondary" onClick={() => navigate({ to: '/split' })}>
          Back to Split
        </Button>
      </Card>
    );
  }

  const hideAmounts = settings.hideAmounts;
  const activeExpenses = raw.expenses
    .filter((expense) => !expense.deletedAt)
    .sort((a, b) =>
      a.date < b.date
        ? 1
        : a.date > b.date
          ? -1
          : a.createdAt < b.createdAt
            ? 1
            : -1,
    );
  const activeSettlements = raw.settlements
    .filter((settlement) => !settlement.deletedAt)
    .sort((a, b) =>
      a.date < b.date
        ? 1
        : a.date > b.date
          ? -1
          : a.createdAt < b.createdAt
            ? 1
            : -1,
    );
  const activeMembers = raw.members.filter((member) => !member.deletedAt && member.active);

  const handleDeleteExpense = async (expense: SplitExpense) => {
    try {
      await splitExpenseRepository.softDelete(expense.id);
      toast.show(`“${expense.title}” deleted`, {
        action: { label: 'Undo', onClick: () => void splitExpenseRepository.restore(expense.id) },
        duration: UNDO_TIMEOUT_MS,
      });
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Could not delete expense', {
        variant: 'error',
      });
    }
  };

  return (
    <div className="space-y-5 pb-24">
      <section className="hero-panel px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate({ to: '/split' })}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] border border-white/10 bg-white/[0.065] text-white/[0.65] transition-colors hover:bg-white/[0.1] hover:text-white"
              aria-label="Back to trips"
            >
              <ArrowLeft size={17} />
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: '/split/group/$groupId/settings', params: { groupId } })}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] border border-white/10 bg-white/[0.065] text-white/[0.65] transition-colors hover:bg-white/[0.1] hover:text-white"
              aria-label="Trip settings"
            >
              <SettingsIcon size={17} />
            </button>
          </div>

          <div className="mt-5 min-w-0">
            <span className="hero-kicker">{activeMembers.length} participant{activeMembers.length === 1 ? '' : 's'} · {group.currency}</span>
            <h1 className="mt-3 truncate text-[2rem] font-semibold leading-none tracking-[-0.05em] text-white sm:text-[2.45rem]">{group.name}</h1>
            {group.description && <p className="mt-2 max-w-xl text-xs leading-5 text-white/[0.42]">{group.description}</p>}
          </div>

          <button
            type="button"
            onClick={() => setInsightsOpen(true)}
            className="mt-6 grid w-full grid-cols-[1fr_1fr_0.72fr_auto] items-center gap-2 rounded-[21px] border border-white/10 bg-white/[0.055] p-3 text-left backdrop-blur transition-colors hover:bg-white/[0.08] sm:p-4"
            aria-label="View trip insights"
          >
            <TripStat
              label="Total spent"
              value={<Money value={{ amountMinor: summary.totalSpent, currency: group.currency }} hide={hideAmounts} />}
            />
            <TripStat
              label="Your share"
              value={<Money value={{ amountMinor: summary.yourShare, currency: group.currency }} hide={hideAmounts} />}
            />
            <TripStat label="To settle" value={String(balanceResult.transfers.length)} accent />
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/[0.07] text-white/40"><ArrowUpRight size={15} /></span>
          </button>
        </div>
      </section>

      <nav
        className="glass-bar grid grid-cols-3 gap-1 rounded-[20px] p-1"
        aria-label="Trip sections"
      >
        {TABS.map((item) => {
          const Icon = item.icon;
          const selected = tab === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setTab(item.value)}
              className={
                selected
                  ? 'flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-[15px] bg-[#17171d] px-2 text-xs font-semibold text-white shadow-soft-xs dark:bg-white dark:text-slate-950'
                  : 'flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-[15px] px-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-white/70 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/[0.05] dark:hover:text-white'
              }
              aria-pressed={selected}
            >
              <Icon size={15} className={selected ? 'text-brand-300 dark:text-brand-600' : undefined} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div key={tab} className="page-enter">
        {tab === 'expenses' && (
          <TripExpensesPanel
            expenses={activeExpenses}
            currency={group.currency}
            hideAmounts={hideAmounts}
            people={people}
            payers={raw.payers}
            shares={raw.shares}
            onDelete={handleDeleteExpense}
            onAdd={() =>
              navigate({
                to: '/split/group/$groupId/add',
                params: { groupId },
                search: { type: 'expense' },
              })
            }
          />
        )}

        {tab === 'balances' && (
          <TripBalancesPanel
            groupId={groupId}
            groupName={group.name}
            currency={group.currency}
            people={people}
            self={self}
            members={activeMembers}
            balances={balanceResult.balances}
            transfers={balanceResult.transfers}
            settlements={activeSettlements}
            hideAmounts={hideAmounts}
          />
        )}

        {tab === 'people' && (
          <TripPeoplePanel
            groupId={groupId}
            people={people}
            self={self}
            members={raw.members}
            expenses={activeExpenses}
            payers={raw.payers}
            shares={raw.shares}
            settlements={activeSettlements}
          />
        )}
      </div>

      <TripInsightsModal
        open={insightsOpen}
        onClose={() => setInsightsOpen(false)}
        currency={group.currency}
        hideAmounts={hideAmounts}
        expenses={activeExpenses}
        payers={raw.payers}
        shares={raw.shares}
        people={people}
        selfPersonId={self.id}
      />
    </div>
  );
}

function TripStat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[9px] font-semibold uppercase tracking-[0.09em] text-white/[0.35] min-[380px]:text-[10px]">{label}</p>
      <div className={accent ? 'mt-1 truncate text-sm font-semibold text-emerald-300 min-[380px]:text-base' : 'mt-1 truncate text-sm font-semibold text-white/[0.88] min-[380px]:text-base'}>
        {value}
      </div>
    </div>
  );
}
