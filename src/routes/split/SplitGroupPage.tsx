import { useEffect, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, ReceiptText, Settings as SettingsIcon, Users, WalletCards } from 'lucide-react';
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
    <div className="space-y-4 pb-24">
      <header className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-1">
          <button
            type="button"
            onClick={() => navigate({ to: '/split' })}
            className="icon-button shrink-0"
            aria-label="Back to trips"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 pt-1">
            <h1 className="truncate text-xl font-semibold">{group.name}</h1>
            <p className="truncate text-sm text-slate-500">
              {activeMembers.length} participant{activeMembers.length === 1 ? '' : 's'} · {group.currency}
            </p>
            {group.description && (
              <p className="mt-1 line-clamp-2 text-xs text-slate-400">{group.description}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate({ to: '/split/group/$groupId/settings', params: { groupId } })}
          className="icon-button shrink-0"
          aria-label="Trip settings"
        >
          <SettingsIcon size={18} />
        </button>
      </header>

      <button
        type="button"
        onClick={() => setInsightsOpen(true)}
        className="block w-full text-left"
        aria-label="View trip insights"
      >
        <Card className="surface-interactive">
          <div className="grid grid-cols-3 gap-3">
            <TripStat
              label="Total spent"
              value={<Money value={{ amountMinor: summary.totalSpent, currency: group.currency }} hide={hideAmounts} />}
            />
            <TripStat
              label="Your share"
              value={<Money value={{ amountMinor: summary.yourShare, currency: group.currency }} hide={hideAmounts} />}
            />
            <TripStat label="To settle" value={String(balanceResult.transfers.length)} accent />
          </div>
          <p className="mt-3 text-xs font-medium text-brand-600">View trip insights</p>
        </Card>
      </button>

      <nav
        className="grid grid-cols-3 gap-1 rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900"
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
                  ? 'flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl bg-brand-600 px-2 text-xs font-semibold text-white'
                  : 'flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl px-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
              }
              aria-pressed={selected}
            >
              <Icon size={16} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

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
      <p className="truncate text-[10px] uppercase tracking-wide text-slate-500 min-[380px]:text-[11px]">{label}</p>
      <div
        className={
          accent
            ? 'mt-1 truncate text-base font-semibold text-emerald-600 min-[380px]:text-lg'
            : 'mt-1 truncate text-base font-semibold min-[380px]:text-lg'
        }
      >
        {value}
      </div>
    </div>
  );
}
