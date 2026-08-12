/**
 * Lend ledger view (single ledger).
 *
 * Reachable from a direct URL but not surfaced in the
 * main navigation. Shows:
 *   - Ledger label (or person + currency if no label)
 *   - Balance
 *   - List of entries
 */

import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Card, MoneySigned, Spinner, EmptyState, useToast } from '@components/ui';
import { useAppSettings } from '@shared/settings/useSettings';
import { usePerson } from '@shared/people/queries';
import {
  useLendLedger,
  useLendEntriesForLedger,
} from '@modules/lend/queries';
import { LendEntryListItem } from '@modules/lend/components/LendEntryListItem';
import { lendLedgerRepository } from '@modules/lend/repositories/lendLedgerRepository';
import { ledgerBalance } from '@modules/lend/domain/balance';

export function LendLedgerPage() {
  const { ledgerId } = useParams({ strict: false }) as { ledgerId: string };
  const navigate = useNavigate();
  const ledger = useLendLedger(ledgerId);
  const person = usePerson(ledger?.personId);
  const entries = useLendEntriesForLedger(ledgerId);
  const settings = useAppSettings();
  const toast = useToast();

  if (!settings || !ledger || !entries) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner />
      </div>
    );
  }

  const hide = !!settings.hideAmounts;
  const balance = ledgerBalance(entries);
  const title = ledger.label ?? `${person?.name ?? 'Person'} · ${ledger.currency}`;

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate({ to: '/lend' })}
          aria-label="Back"
          className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="truncate text-lg font-semibold">{title}</h1>
        <button
          type="button"
          onClick={async () => {
            try {
              await lendLedgerRepository.softDelete(ledger.id);
              toast.show('Ledger deleted', {
                action: {
                  label: 'Undo',
                  onClick: async () => {
                    await lendLedgerRepository.restore(ledger.id);
                  },
                },
              });
              navigate({ to: '/lend' });
            } catch (err) {
              toast.show(err instanceof Error ? err.message : 'Could not delete', {
                variant: 'error',
              });
            }
          }}
          aria-label="Delete ledger"
          className="ml-auto rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800"
        >
          <Trash2 size={16} />
        </button>
      </header>

      <Card>
        <p className="text-xs uppercase tracking-wider text-slate-500">Balance</p>
        <p className="mt-1 text-2xl font-semibold">
          <MoneySigned amountMinor={Math.abs(balance)} currency={ledger.currency} hide={hide} />
        </p>
        {balance !== 0 && (
          <p className="mt-1 text-xs text-slate-500">
            {balance > 0 ? 'They owe you' : 'You owe them'}
          </p>
        )}
        {balance === 0 && entries.length > 0 && (
          <p className="mt-1 text-xs text-slate-500">Settled</p>
        )}
      </Card>

      {entries.length === 0 ? (
        <Card>
          <EmptyState
            title="No entries"
            description="This ledger has no entries yet."
          />
        </Card>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li key={e.id}>
              <LendEntryListItem entry={e} person={person} currency={ledger.currency} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
