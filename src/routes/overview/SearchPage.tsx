/**
 * Global search across Track, Split, Lend, People.
 *
 * Returns results with their module context so the user
 * can jump straight into the right place.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDB } from '@db/database';
import { Card, EmptyState, Input, Spinner } from '@components/ui';
import { Search as SearchIcon, Receipt, Users, HandCoins, UserCircle } from 'lucide-react';
import { formatHumanDate } from '@shared/dates';

interface SearchHit {
  id: string;
  module: 'track' | 'split' | 'lend' | 'person';
  title: string;
  subtitle?: string;
  amountMinor?: number;
  currency?: string;
  to: string;
}

export function SearchPage() {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const all = useLiveQuery(async () => {
    const db = getDB();
    const [track, expenses, groups, people, lendEntries, ledgers] = await Promise.all([
      db.trackTransactions.toArray(),
      db.splitExpenses.toArray(),
      db.splitGroups.toArray(),
      db.people.toArray(),
      db.lendEntries.toArray(),
      db.lendLedgers.toArray(),
    ]);
    return { track, expenses, groups, people, lendEntries, ledgers };
  }, []);

  const results: SearchHit[] = useMemo(() => {
    if (!all || !q.trim()) return [];
    const needle = q.trim().toLowerCase();
    const hits: SearchHit[] = [];

    for (const p of all.people) {
      if (p.deletedAt) continue;
      if (p.name.toLowerCase().includes(needle)) {
        hits.push({
          id: p.id,
          module: 'person',
          title: p.name + (p.isSelf ? ' (you)' : ''),
          to: `/settings/people`,
        });
      }
      if (p.note && p.note.toLowerCase().includes(needle)) {
        hits.push({
          id: p.id,
          module: 'person',
          title: p.name,
          subtitle: p.note,
          to: `/settings/people`,
        });
      }
    }
    for (const t of all.track) {
      if (t.deletedAt) continue;
      if (t.title.toLowerCase().includes(needle)) {
        hits.push({
          id: t.id,
          module: 'track',
          title: t.title,
          subtitle: `Track · ${formatHumanDate(t.date)}`,
          amountMinor: t.amountMinor,
          currency: t.currency,
          to: `/track/transaction/${t.id}`,
        });
      }
    }
    for (const g of all.groups) {
      if (g.deletedAt) continue;
      if (g.name.toLowerCase().includes(needle)) {
        hits.push({
          id: g.id,
          module: 'split',
          title: g.name,
          subtitle: 'Group',
          to: `/split/group/${g.id}`,
        });
      }
    }
    for (const e of all.expenses) {
      if (e.deletedAt) continue;
      if (e.title.toLowerCase().includes(needle)) {
        const g = all.groups.find((x) => x.id === e.groupId);
        hits.push({
          id: e.id,
          module: 'split',
          title: e.title,
          subtitle: g ? `Split · ${g.name} · ${formatHumanDate(e.date)}` : 'Split',
          amountMinor: e.amountMinor,
          currency: e.currency,
          to: `/split/group/${e.groupId}`,
        });
      }
    }
    for (const entry of all.lendEntries) {
      if (entry.deletedAt) continue;
      const l = all.ledgers.find((x) => x.id === entry.ledgerId);
      if (!l) continue;
      const person = all.people.find((p) => p.id === l.personId);
      const note = entry.note ?? '';
      if (note.toLowerCase().includes(needle) || (person?.name.toLowerCase().includes(needle) ?? false)) {
        hits.push({
          id: entry.id,
          module: 'lend',
          title: note || `${entry.type} · ${person?.name ?? ''}`,
          subtitle: `Lend · ${person?.name ?? ''} · ${formatHumanDate(entry.date)}`,
          to: `/lend/person/${l.personId}`,
        });
      }
    }
    return hits.slice(0, 100);
  }, [all, q]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Search</h1>
      <Input
        autoFocus
        placeholder="Search transactions, groups, people, notes…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search"
      />
      {!q.trim() ? (
        <Card>
          <EmptyState
            title="Type to search"
            description="Search across Track, Split, Lend, and People."
            icon={<SearchIcon size={32} />}
          />
        </Card>
      ) : all === undefined ? (
        <Spinner />
      ) : results.length === 0 ? (
        <Card>
          <EmptyState title="No results" description={`Nothing matched "${q}"`} />
        </Card>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {results.map((r) => (
              <li key={`${r.module}-${r.id}`}>
                <button
                  type="button"
                  onClick={() => navigate({ to: r.to })}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="text-slate-500">
                    {r.module === 'track' ? (
                      <Receipt size={18} />
                    ) : r.module === 'split' ? (
                      <Users size={18} />
                    ) : r.module === 'lend' ? (
                      <HandCoins size={18} />
                    ) : (
                      <UserCircle size={18} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.title}</p>
                    {r.subtitle && <p className="truncate text-xs text-slate-500">{r.subtitle}</p>}
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
