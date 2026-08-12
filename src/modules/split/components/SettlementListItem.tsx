/**
 * SettlementListItem.
 *
 * Row in a settlement list. Shows the from -> to arrow,
 * the amount, and the date.
 */

import clsx from 'clsx';
import { Money } from '@components/ui';
import { ArrowRight } from 'lucide-react';
import type { SplitSettlement, Person } from '@db/schema';
import { formatHumanDate } from '@shared/dates';

interface SettlementListItemProps {
  settlement: SplitSettlement;
  people: Person[];
  selfPersonId?: string;
}

export function SettlementListItem({ settlement, people, selfPersonId }: SettlementListItemProps) {
  const from = people.find((p) => p.id === settlement.fromPersonId);
  const to = people.find((p) => p.id === settlement.toPersonId);
  const youSent = selfPersonId === settlement.fromPersonId;
  const youReceived = selfPersonId === settlement.toPersonId;
  return (
    <li className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{from?.name ?? 'Unknown'}</span>
          <ArrowRight size={14} className="text-slate-400" />
          <span className="font-medium">{to?.name ?? 'Unknown'}</span>
        </div>
        <div className="mt-0.5 text-xs text-slate-500">
          {formatHumanDate(settlement.date)}
          {settlement.note && <span> · {settlement.note}</span>}
        </div>
      </div>
      <div
        className={clsx(
          'text-right text-sm font-semibold tabular-nums',
          youReceived && 'text-emerald-600',
          youSent && 'text-rose-600',
        )}
      >
        <Money value={{ amountMinor: settlement.amountMinor, currency: settlement.currency }} />
      </div>
    </li>
  );
}
