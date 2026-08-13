/**
 * Lend person detail page.
 */

import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, Plus } from 'lucide-react';
import { Card, Money, Spinner, EmptyState } from '@components/ui';
import { useAppSettings } from '@shared/settings/useSettings';
import { usePerson } from '@shared/people/queries';
import { useLendPersonDetail } from '@modules/lend/queries';
import { LendEntryListItem } from '@modules/lend/components/LendEntryListItem';

export function LendPersonPage() {
  const { personId } = useParams({ strict: false }) as { personId: string };
  const navigate = useNavigate();
  const person = usePerson(personId);
  const settings = useAppSettings();
  const detail = useLendPersonDetail(personId);

  if (!settings || !person || !detail) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner />
      </div>
    );
  }

  const hide = !!settings.hideAmounts;
  const { totalBalance, entries, currency } = detail;
  const balanceLabel =
    totalBalance > 0
      ? `${person.name} owes you`
      : totalBalance < 0
        ? `You owe ${person.name}`
        : 'Settled';

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
        <h1 className="truncate text-lg font-semibold">{person.name}</h1>
      </header>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{balanceLabel}</p>
        <p className={totalBalance > 0 ? 'mt-1 text-2xl font-semibold text-emerald-600' : totalBalance < 0 ? 'mt-1 text-2xl font-semibold text-rose-600' : 'mt-1 text-2xl font-semibold text-slate-500'}>
          <Money
            value={{ amountMinor: Math.abs(totalBalance), currency: currency ?? settings.defaultCurrency }}
            hide={hide}
            emphasize
          />
        </p>
      </Card>

      {entries.length === 0 ? (
        <Card>
          <EmptyState
            title="No entries yet"
            description="Add the first lent or borrowed amount to start tracking this person."
            action={
              <button
                type="button"
                onClick={() => navigate({ to: '/lend/add', search: { type: 'lent', personId: person.id } as never })}
                className="inline-flex h-11 items-center gap-1.5 rounded-full bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
              >
                <Plus size={16} /> Add entry
              </button>
            }
          />
        </Card>
      ) : (
        <section>
          <h2 className="section-title mb-2">History</h2>
          <ul className="space-y-2">
            {entries.map((e) => (
              <li key={e.id}>
                <LendEntryListItem entry={e} person={person} currency={currency ?? settings.defaultCurrency} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {entries.length > 0 && (
        <button
          type="button"
          onClick={() => navigate({ to: '/lend/add', search: { type: 'lent', personId: person.id } as never })}
          className="fixed bottom-24 right-4 z-20 inline-flex h-12 items-center gap-1.5 rounded-full bg-brand-600 px-5 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 hover:bg-brand-700 sm:bottom-6"
        >
          <Plus size={16} /> Add entry
        </button>
      )}
    </div>
  );
}
