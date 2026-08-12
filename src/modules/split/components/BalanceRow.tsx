/**
 * BalanceRow.
 *
 * One row of the per-person balances table. Uses
 * `BalanceText` so the label "Owes you" / "You owe" is
 * in text, not just color (accessibility, work.md §81).
 */

import clsx from 'clsx';
import { Money, BalanceText } from '@components/ui';
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
  return (
    <li className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex-1">
        <div className="text-sm font-medium">
          {person.name}
          {person.isSelf && <span className="ml-1 text-xs text-slate-500">(me)</span>}
          {isSelf && <span className="ml-1 text-xs text-slate-500">· you</span>}
        </div>
        <BalanceText amountMinor={amountMinor}>
          <Money
            value={{ amountMinor: Math.abs(amountMinor), currency }}
            hide={hide}
            className={clsx(
              amountMinor > 0 && 'text-emerald-600',
              amountMinor < 0 && 'text-rose-600',
            )}
          />
        </BalanceText>
      </div>
    </li>
  );
}
