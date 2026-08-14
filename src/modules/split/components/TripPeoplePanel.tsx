import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Card, Input, useToast } from '@components/ui';
import type { Person, SplitExpense } from '@db/schema';
import { personRepository } from '@shared/people/repository';
import { splitGroupMemberRepository } from '../repositories/splitGroupMemberRepository';

interface TripPeoplePanelProps {
  groupId: string;
  people: Person[];
  self: Person;
  members: Array<{ id: string; personId: string; active: boolean; deletedAt?: string }>;
  expenses: SplitExpense[];
  payers: Array<{ expenseId: string; personId: string }>;
  shares: Array<{ expenseId: string; personId: string }>;
  settlements: Array<{ fromPersonId: string; toPersonId: string }>;
}

export function TripPeoplePanel({
  groupId,
  people,
  self,
  members,
  expenses,
  payers,
  shares,
  settlements,
}: TripPeoplePanelProps) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);

  const activeMembers = members.filter((member) => !member.deletedAt && member.active);
  const activeIds = new Set(activeMembers.map((member) => member.personId));
  const activeExpenseIds = new Set(expenses.map((expense) => expense.id));
  const usedIds = new Set<string>();

  for (const payer of payers) if (activeExpenseIds.has(payer.expenseId)) usedIds.add(payer.personId);
  for (const share of shares) if (activeExpenseIds.has(share.expenseId)) usedIds.add(share.personId);
  for (const settlement of settlements) {
    usedIds.add(settlement.fromPersonId);
    usedIds.add(settlement.toPersonId);
  }

  const personMap = new Map(people.map((person) => [person.id, person]));
  const candidates = people.filter((person) => !person.isSelf && !activeIds.has(person.id));

  const addNewPerson = async () => {
    const cleanName = name.trim();
    if (!cleanName) return;
    setAdding(true);
    try {
      const existing = people.find(
        (person) => person.name.trim().toLocaleLowerCase() === cleanName.toLocaleLowerCase(),
      );
      const person = existing ?? await personRepository.create({ name: cleanName });
      await splitGroupMemberRepository.getOrCreate(groupId, person.id);
      setName('');
      toast.show(`${person.name} added to trip`, { variant: 'success' });
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Could not add person', { variant: 'error' });
    } finally {
      setAdding(false);
    }
  };

  const addSaved = async (person: Person) => {
    try {
      await splitGroupMemberRepository.getOrCreate(groupId, person.id);
      toast.show(`${person.name} added to trip`, { variant: 'success' });
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Could not add person', { variant: 'error' });
    }
  };

  const removeFromTrip = async (memberId: string, person: Person) => {
    if (person.id === self.id || usedIds.has(person.id)) return;
    try {
      await splitGroupMemberRepository.setActive(memberId, false);
      toast.show(`${person.name} removed from this trip`);
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Could not remove person', { variant: 'error' });
    }
  };

  return (
    <section className="space-y-4">
      <Card>
        <h2 className="text-sm font-semibold">Add participant</h2>
        <p className="mt-1 text-xs text-slate-500">
          Choose a saved person below or type a name. Matching names reuse the existing person.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Input
              name="participant-name"
              label="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter name"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void addNewPerson();
                }
              }}
            />
          </div>
          <Button className="sm:shrink-0" onClick={() => void addNewPerson()} disabled={!name.trim() || adding}>
            <Plus size={16} /> {adding ? 'Adding…' : 'Add'}
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        {activeMembers.map((member) => {
          const person = personMap.get(member.personId);
          if (!person) return null;
          const used = usedIds.has(person.id);
          return (
            <Card key={member.id}>
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">
                  {person.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{person.isSelf ? 'You' : person.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {person.isSelf ? 'This is you' : used ? 'Used in current trip activity' : 'No current activity'}
                  </p>
                </div>
                {!person.isSelf && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0"
                    disabled={used}
                    onClick={() => void removeFromTrip(member.id, person)}
                    title={used ? 'People used in current expenses or payments stay in trip history.' : undefined}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {candidates.length > 0 && (
        <details className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Add a saved person</summary>
          <div className="max-h-64 space-y-1 overflow-y-auto border-t border-slate-100 p-2 dark:border-slate-800">
            {candidates.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => void addSaved(person)}
                className="flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <span className="truncate">{person.name}</span>
                <Plus size={15} className="shrink-0 text-slate-400" />
              </button>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
