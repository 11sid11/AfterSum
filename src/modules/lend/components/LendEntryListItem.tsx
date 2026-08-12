/**
 * LendEntryListItem — a single entry row in the
 * Person / Ledger / Dashboard lists.
 *
 * Layout:
 *
 *   [icon]  Lend   Rahul lent you        13 Aug
 *           ────    +₹2,000
 *
 *   [icon]  Repaid  Rahul repaid you      3 Aug
 *           ────    −₹1,000
 *
 * Soft-delete is exposed via a small overflow menu so
 * the surrounding list can render an Undo toast.
 */

import { type ReactNode } from 'react';
import { ArrowUpFromLine, ArrowDownToLine, CornerDownRight, CornerDownLeft, Sliders, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { MoneySigned, useToast } from '@components/ui';
import { useAppSettings } from '@shared/settings/useSettings';
import { formatHumanDate } from '@shared/dates';
import type { LendEntry, LendEntryType, Person } from '@db/schema';
import { ENTRY_TYPE_SHORT_LABEL } from '../domain/signs';
import { entryToSignedAmount } from '../domain/signs';
import { lendEntryRepository } from '../repositories/lendEntryRepository';

const ICON_MAP: Record<LendEntryType, ReactNode> = {
  lent: <ArrowUpFromLine size={18} className="text-emerald-600" />,
  borrowed: <ArrowDownToLine size={18} className="text-rose-600" />,
  repayment_received: <CornerDownRight size={18} className="text-sky-600" />,
  repayment_given: <CornerDownLeft size={18} className="text-sky-600" />,
  adjustment: <Sliders size={18} className="text-slate-500" />,
};

const ICON_BG: Record<LendEntryType, string> = {
  lent: 'bg-emerald-100 dark:bg-emerald-900/30',
  borrowed: 'bg-rose-100 dark:bg-rose-900/30',
  repayment_received: 'bg-sky-100 dark:bg-sky-900/30',
  repayment_given: 'bg-sky-100 dark:bg-sky-900/30',
  adjustment: 'bg-slate-100 dark:bg-slate-800',
};

interface LendEntryListItemProps {
  entry: LendEntry;
  /** Optional person, when the list aggregates multiple ledgers. */
  person?: Person;
  /** Default currency of the ledger the entry belongs to. */
  currency: string;
  /** Allow delete + undo. Defaults to true. */
  allowDelete?: boolean;
}

export function LendEntryListItem({
  entry,
  person,
  currency,
  allowDelete = true,
}: LendEntryListItemProps) {
  const toast = useToast();
  const settings = useAppSettings();
  const hide = !!settings?.hideAmounts;
  const signed = entryToSignedAmount(entry);
  const typeLabel = ENTRY_TYPE_SHORT_LABEL[entry.type];

  const description =
    entry.type === 'lent'
      ? `You lent ${person?.name ?? 'them'}`
      : entry.type === 'borrowed'
        ? `You borrowed from ${person?.name ?? 'them'}`
        : entry.type === 'repayment_received'
          ? `${person?.name ?? 'They'} repaid you`
          : entry.type === 'repayment_given'
            ? `You repaid ${person?.name ?? 'them'}`
            : entry.note || 'Adjustment';

  return (
    <div
      className={clsx(
        'flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900',
        entry.deletedAt && 'opacity-50',
      )}
    >
      <div
        className={clsx(
          'grid h-10 w-10 shrink-0 place-items-center rounded-full',
          ICON_BG[entry.type],
        )}
        aria-hidden
      >
        {ICON_MAP[entry.type]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-medium">
            <span className="text-slate-500">{typeLabel}</span>
            <span className="mx-1 text-slate-300">·</span>
            <span>{description}</span>
          </p>
          <MoneySigned amountMinor={signed} currency={currency} hide={hide} />
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-slate-500">
          <span>{formatHumanDate(entry.date)}</span>
          {entry.note && !entry.deletedAt && (
            <span className="truncate text-right" title={entry.note}>
              {entry.note}
            </span>
          )}
        </div>
      </div>
      {allowDelete && !entry.deletedAt && (
        <button
          type="button"
          onClick={async () => {
            try {
              await lendEntryRepository.softDelete(entry.id);
              toast.show('Entry deleted', {
                action: {
                  label: 'Undo',
                  onClick: async () => {
                    await lendEntryRepository.restore(entry.id);
                  },
                },
              });
            } catch (err) {
              toast.show(err instanceof Error ? err.message : 'Could not delete', {
                variant: 'error',
              });
            }
          }}
          aria-label="Delete entry"
          className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}
