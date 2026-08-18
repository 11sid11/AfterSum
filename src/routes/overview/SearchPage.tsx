/** Global search across Track, Split, Lend, and People. */

import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Card, EmptyState, Input, Spinner } from '@components/ui';
import { useGlobalSearchData } from '@overview/queries/useGlobalSearchData';
import { Search as SearchIcon, Receipt, Users, HandCoins, UserCircle } from 'lucide-react';
import { formatHumanDate } from '@shared/dates';
import type { LendEntryType } from '@db/schema';

interface SearchHit {
  id: string;
  module: 'track' | 'split' | 'lend' | 'person';
  title: string;
  subtitle?: string;
  to: string;
}

function lendEntryLabel(type: LendEntryType): string {
  switch (type) {
    case 'lent': return 'Money lent';
    case 'borrowed': return 'Money borrowed';
    case 'repayment_received': return 'Repayment received';
    case 'repayment_given': return 'Repayment made';
    case 'adjustment': return 'Balance adjustment';
  }
}

export function SearchPage() {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const all = useGlobalSearchData();

  const results = useMemo<SearchHit[]>(() => {
    if (!all || !q.trim()) return [];
    const needle = q.trim().toLocaleLowerCase();
    const hits: SearchHit[] = [];
    const visibleGroups = new Map(
      all.groups.filter((group) => !group.deletedAt).map((group) => [group.id, group]),
    );
    const visiblePeople = new Map(
      all.people.filter((person) => !person.deletedAt).map((person) => [person.id, person]),
    );
    const visibleLedgers = new Map(
      all.ledgers.filter((ledger) => !ledger.deletedAt).map((ledger) => [ledger.id, ledger]),
    );

    for (const person of visiblePeople.values()) {
      const nameMatches = person.name.toLocaleLowerCase().includes(needle);
      const noteMatches = person.note?.toLocaleLowerCase().includes(needle) ?? false;
      if (nameMatches || noteMatches) {
        hits.push({
          id: person.id,
          module: 'person',
          title: person.name + (person.isSelf ? ' (you)' : ''),
          subtitle: noteMatches && person.note ? person.note : 'Person',
          to: '/settings/people',
        });
      }
    }

    for (const transaction of all.track) {
      if (transaction.deletedAt || !transaction.title.toLocaleLowerCase().includes(needle)) continue;
      hits.push({
        id: transaction.id,
        module: 'track',
        title: transaction.title,
        subtitle: `Track · ${formatHumanDate(transaction.date)}`,
        to: `/track/transaction/${transaction.id}`,
      });
    }

    for (const group of visibleGroups.values()) {
      if (!group.name.toLocaleLowerCase().includes(needle)) continue;
      hits.push({ id: group.id, module: 'split', title: group.name, subtitle: group.archived ? 'Archived trip' : 'Trip', to: `/split/group/${group.id}` });
    }

    for (const expense of all.expenses) {
      if (expense.deletedAt || !expense.title.toLocaleLowerCase().includes(needle)) continue;
      const group = visibleGroups.get(expense.groupId);
      if (!group) continue;
      hits.push({
        id: expense.id,
        module: 'split',
        title: expense.title,
        subtitle: `Split · ${group.name} · ${formatHumanDate(expense.date)}`,
        to: `/split/group/${expense.groupId}`,
      });
    }

    for (const entry of all.lendEntries) {
      if (entry.deletedAt) continue;
      const ledger = visibleLedgers.get(entry.ledgerId);
      if (!ledger) continue;
      const person = visiblePeople.get(ledger.personId);
      if (!person) continue;
      const note = entry.note?.trim() ?? '';
      if (!note.toLocaleLowerCase().includes(needle) && !person.name.toLocaleLowerCase().includes(needle)) continue;
      hits.push({
        id: entry.id,
        module: 'lend',
        title: note || lendEntryLabel(entry.type),
        subtitle: `Lend · ${person.name} · ${formatHumanDate(entry.date)}`,
        to: `/lend/person/${person.id}`,
      });
    }

    return hits.slice(0, 100);
  }, [all, q]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Search</h1>
      <Input autoFocus placeholder="Search transactions, trips, people, notes…" value={q} onChange={(event) => setQ(event.target.value)} aria-label="Search" />
      {!q.trim() ? (
        <Card><EmptyState title="Type to search" description="Search across Track, Split, Lend, and People." icon={<SearchIcon size={32} />} /></Card>
      ) : all === undefined ? (
        <Spinner />
      ) : results.length === 0 ? (
        <Card><EmptyState title="No results" description={`Nothing matched "${q}"`} /></Card>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {results.map((result) => (
              <li key={`${result.module}-${result.id}`}>
                <button type="button" onClick={() => navigate({ to: result.to })} className="flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <div className="shrink-0 text-slate-500">
                    {result.module === 'track' ? <Receipt size={18} /> : result.module === 'split' ? <Users size={18} /> : result.module === 'lend' ? <HandCoins size={18} /> : <UserCircle size={18} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{result.title}</p>
                    {result.subtitle && <p className="truncate text-xs text-slate-500">{result.subtitle}</p>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
