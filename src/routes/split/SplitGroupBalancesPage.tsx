/**
 * Per-person balances + simplified debts.
 *
 * Renders the full balances table with "Owes you" / "You owe"
 * text labels (not color alone — work.md §81), and below it a
 * "Suggested transfers" list computed by `simplifyDebts`.
 */

import { useNavigate, useParams } from '@tanstack/react-router';
import { Money, Spinner, Card } from '@components/ui';
import { ArrowRight } from 'lucide-react';
import { useSplitGroup, useSplitGroupBalances, useSplitGroupMembers } from '@modules/split/queries';
import { usePeople, useSelf } from '@shared/people/queries';
import { useAppSettings } from '@shared/settings/useSettings';
import { BalanceRow } from '@modules/split/components/BalanceRow';

export function SplitGroupBalancesPage() {
  const params = useParams({ from: '/split/group/$groupId/balances' });
  const groupId = params.groupId;
  const navigate = useNavigate();
  const group = useSplitGroup(groupId);
  const members = useSplitGroupMembers(groupId, true);
  const balances = useSplitGroupBalances(groupId);
  const people = usePeople();
  const self = useSelf();
  const settings = useAppSettings();
  const hide = settings?.hideAmounts ?? false;

  if (!group || !members || !balances || !people || !self) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  const personMap = new Map(people.map((p) => [p.id, p]));
  const memberPersonIds = new Set(members.filter((m) => m.active).map((m) => m.personId));
  const memberPeople = people.filter((p) => memberPersonIds.has(p.id));

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Balances · {group.name}</h1>
        <button
          type="button"
          onClick={() => navigate({ to: '/split/group/$groupId', params: { groupId } })}
          className="text-sm text-brand-600 hover:underline"
        >
          Back
        </button>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Per person</h2>
        <ul className="space-y-1">
          {memberPeople.map((p) => (
            <BalanceRow
              key={p.id}
              person={p}
              amountMinor={balances.balances.get(p.id) ?? 0}
              currency={group.currency}
              selfPersonId={self.id}
            />
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Suggested transfers
        </h2>
        {balances.transfers.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500">Everyone is settled. Nothing to transfer.</p>
          </Card>
        ) : (
          <ul className="space-y-1">
            {balances.transfers.map((t, i) => {
              const from = personMap.get(t.fromPersonId);
              const to = personMap.get(t.toPersonId);
              return (
                <li
                  key={`${t.fromPersonId}-${t.toPersonId}-${i}`}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <span className="flex-1">
                    <span className="font-medium">{from?.name ?? 'Unknown'}</span>
                    <ArrowRight size={14} className="mx-1 inline text-slate-400" />
                    <span className="font-medium">{to?.name ?? 'Unknown'}</span>
                  </span>
                  <span className="font-semibold tabular-nums">
                    <Money value={{ amountMinor: t.amountMinor, currency: group.currency }} hide={hide} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
