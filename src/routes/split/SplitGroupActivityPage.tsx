/**
 * Activity feed for a group: expenses and settlements in
 * reverse chronological order.
 */

import { useNavigate, useParams } from '@tanstack/react-router';
import { Spinner, Card, useToast } from '@components/ui';
import { useSplitGroup, useSplitGroupExpenses, useSplitGroupSettlements } from '@modules/split/queries';
import { usePeople, useSelf } from '@shared/people/queries';
import { ExpenseListItem } from '@modules/split/components/ExpenseListItem';
import { SettlementListItem } from '@modules/split/components/SettlementListItem';
import { splitExpenseRepository } from '@modules/split/repositories/splitExpenseRepository';
import { splitSettlementRepository } from '@modules/split/repositories/splitSettlementRepository';
import { UNDO_TIMEOUT_MS } from '@app/constants';
import type { SplitExpense, SplitSettlement } from '@db/schema';

type Item =
  | { kind: 'expense'; date: string; data: SplitExpense }
  | { kind: 'settlement'; date: string; data: SplitSettlement };

export function SplitGroupActivityPage() {
  const params = useParams({ from: '/split/group/$groupId/activity' });
  const groupId = params.groupId;
  const navigate = useNavigate();
  const group = useSplitGroup(groupId);
  const expenses = useSplitGroupExpenses(groupId);
  const settlements = useSplitGroupSettlements(groupId);
  const people = usePeople();
  const self = useSelf();
  const toast = useToast();

  if (!group || expenses === undefined || settlements === undefined || !people || !self) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  const items: Item[] = [
    ...expenses.map((e): Item => ({ kind: 'expense', date: e.date, data: e })),
    ...settlements.map((s): Item => ({ kind: 'settlement', date: s.date, data: s })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const handleDeleteExpense = async (id: string, title: string) => {
    await splitExpenseRepository.softDelete(id);
    toast.show(`"${title}" deleted`, {
      action: { label: 'Undo', onClick: () => void splitExpenseRepository.restore(id) },
      duration: UNDO_TIMEOUT_MS,
    });
  };

  const handleDeleteSettlement = async (id: string) => {
    await splitSettlementRepository.softDelete(id);
    toast.show('Settlement deleted', {
      action: { label: 'Undo', onClick: () => void splitSettlementRepository.restore(id) },
      duration: UNDO_TIMEOUT_MS,
    });
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Activity · {group.name}</h1>
        <button
          type="button"
          onClick={() => navigate({ to: '/split/group/$groupId', params: { groupId } })}
          className="text-sm text-brand-600 hover:underline"
        >
          Back
        </button>
      </div>

      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">No activity yet.</p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {items.map((item) =>
            item.kind === 'expense' ? (
              <div key={item.data.id} className="relative">
                <ExpenseListItem expense={item.data} />
                <button
                  type="button"
                  onClick={() => void handleDeleteExpense(item.data.id, item.data.title)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800"
                  aria-label={`Delete ${item.data.title}`}
                >
                  ×
                </button>
              </div>
            ) : (
              <div key={item.data.id} className="relative">
                <SettlementListItem settlement={item.data} people={people} selfPersonId={self.id} />
                <button
                  type="button"
                  onClick={() => void handleDeleteSettlement(item.data.id)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800"
                  aria-label="Delete settlement"
                >
                  ×
                </button>
              </div>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
