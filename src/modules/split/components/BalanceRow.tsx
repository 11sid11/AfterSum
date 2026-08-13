/**
 * One row of the per-person group balance table.
 *
 * Group balance semantics are intentionally neutral:
 * positive = this person should receive from the group;
 * negative = this person owes the group. Bilateral "pays you"
 * wording is reserved for simplified transfer suggestions.
 */

import clsx from 'clsx';
import { Money } from '@components/ui';
import type { Person } from '@db/schema';
import { useAppSettings } from '@shared/settings/useSettings';

interface BalanceRowProps {
  person: Person;
  amountMinor: number;
  currency: string;
  selfPersonId?: string;
}

export function BalanceRow({ person, amountMinor, currency, selfPersonId }: BalanceRowProps) {
  const settings = useAppSettings();
  const hide = settings?.hideAmounts ?? false;
  const isSelf = selfPersonId === person.id;
  const status =
    amountMinor > 0
      ? isSelf
        ? 'You get back'
        : 'Gets back'
      : amountMinor < 0
        ? isSelf
          ? 'You owe'
          : 'Owes'
        : 'Settled';

  return (
    <li className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">
          {isSelf ? 'You' : person.name}
        </div>
        <p className="text-xs text-slate-500">{status}</p>
      </div>
      <Money
        value={{ amountMinor: Math.abs(amountMinor), currency }}
        hide={hide}
        className={clsx(
          'text-sm font-semibold',
          amountMinor > 0 && 'text-emerald-600',
          amountMinor < 0 && 'text-rose-600',
          amountMinor === 0 && 'text-slate-500',
        )}
      />
    </li>
  );
}
