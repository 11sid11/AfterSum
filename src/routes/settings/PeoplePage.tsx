import { useMemo, useState } from 'react';
import { personRepository } from '@shared/people/repository';
import { personNameKey } from '@shared/people/domain';
import { usePeople } from '@shared/people/queries';
import { Card, Button, Input, EmptyState, Spinner, useToast } from '@components/ui';
import { AlertTriangle, Pencil, Plus, Trash2, User, Users } from 'lucide-react';

export function PeoplePage() {
  const people = usePeople();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const toast = useToast();

  const duplicateNameKeys = useMemo(() => {
    if (!people) return new Set<string>();
    const counts = new Map<string, number>();
    for (const person of people) {
      const key = personNameKey(person.name);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
  }, [people]);

  const duplicateByName = (candidate: string, exceptId?: string) =>
    people?.find(
      (person) => person.id !== exceptId && personNameKey(person.name) === personNameKey(candidate),
    );

  const add = async () => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const duplicate = duplicateByName(cleanName);
    if (duplicate) {
      toast.show(`${duplicate.name} is already in People. Choose a unique name.`, { variant: 'error' });
      return;
    }

    try {
      const created = await personRepository.create({ name: cleanName });
      setName('');
      setAdding(false);
      toast.show(`${created.name} added`, { variant: 'success' });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not add person', { variant: 'error' });
    }
  };

  const saveEdit = async () => {
    if (!editingId || !editingName.trim()) return;
    const cleanName = editingName.trim();
    const duplicate = duplicateByName(cleanName, editingId);
    if (duplicate) {
      toast.show(`${duplicate.name} already uses that name. Choose a unique name.`, { variant: 'error' });
      return;
    }
    try {
      await personRepository.update(editingId, { name: cleanName });
      toast.show('Name updated', { variant: 'success' });
      setEditingId(null);
      setEditingName('');
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not update person', { variant: 'error' });
    }
  };

  const remove = async (id: string, personName: string) => {
    if (id === 'self') return;
    try {
      await personRepository.softDelete(id);
      toast.show(`${personName} removed`, {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await personRepository.restore(id);
            } catch (err) {
              toast.show(err instanceof Error ? err.message : 'Could not restore person', { variant: 'error' });
            }
          },
        },
      });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not remove person', { variant: 'error' });
    }
  };

  if (people === undefined) return <Spinner />;

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">People</h1>
          <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
            One reusable contact list for Split and Lend. People are identities only; balances stay inside each module.
          </p>
        </div>
        {!adding && (
          <Button size="sm" className="shrink-0" onClick={() => setAdding(true)}>
            <Plus size={16} /> Add person
          </Button>
        )}
      </header>

      <div className="flex items-start gap-2.5 rounded-[15px] border border-brand-200/70 bg-brand-50/70 px-3.5 py-3 text-xs leading-5 text-brand-950 dark:border-brand-400/[0.16] dark:bg-brand-400/[0.07] dark:text-brand-100">
        <Users size={16} className="mt-0.5 shrink-0" />
        <p>
          Add someone once, then reuse them anywhere. Trip membership is managed inside each Split trip; Lend uses the same saved person.
        </p>
      </div>

      {duplicateNameKeys.size > 0 && (
        <Card className="border-amber-300/80 bg-amber-50/80 dark:border-amber-400/[0.2] dark:bg-amber-400/[0.06]">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" />
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Some existing people share a name</p>
              <p className="mt-1 text-xs leading-5 text-amber-800/80 dark:text-amber-200/80">
                Rename the marked entries so every active person has a unique name. AfterSum now prevents new duplicate names.
              </p>
            </div>
          </div>
        </Card>
      )}

      {adding && (
        <Card>
          <div className="mb-3">
            <h2 className="text-sm font-semibold">Add person</h2>
            <p className="mt-1 text-xs text-slate-500">Use a name that is different from every other saved person.</p>
          </div>
          <Input
            autoFocus
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            hint="Names are matched without case and extra spaces."
            maxLength={120}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void add();
              if (event.key === 'Escape') {
                setAdding(false);
                setName('');
              }
            }}
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setAdding(false); setName(''); }}>Cancel</Button>
            <Button onClick={() => void add()} disabled={!name.trim()}>Save person</Button>
          </div>
        </Card>
      )}

      {people.length === 0 ? (
        <Card>
          <EmptyState
            title="No people yet"
            description="Add someone once, then use them in Split trips or Lend entries."
            icon={<User size={32} />}
            action={<Button onClick={() => setAdding(true)}><Plus size={16} /> Add person</Button>}
          />
        </Card>
      ) : (
        <Card padded={false} className="overflow-hidden">
          <ul className="divide-y divide-slate-100 dark:divide-white/[0.07]">
            {people.map((person) => {
              const duplicate = duplicateNameKeys.has(personNameKey(person.name));
              return (
                <li key={person.id} className="px-4 py-3.5 sm:px-5">
                  {editingId === person.id ? (
                    <div className="space-y-3 sm:flex sm:items-end sm:gap-2 sm:space-y-0">
                      <div className="min-w-0 flex-1">
                        <Input
                          label="Name"
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          hint="Every active person needs a unique name."
                          autoFocus
                          maxLength={120}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') void saveEdit();
                            if (event.key === 'Escape') {
                              setEditingId(null);
                              setEditingName('');
                            }
                          }}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditingName(''); }}>Cancel</Button>
                        <Button size="sm" onClick={() => void saveEdit()} disabled={!editingName.trim()}>Save</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                        {person.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-medium">{person.name}</p>
                          {person.isSelf && <span className="text-[10px] font-medium text-slate-400">You</span>}
                          {duplicate && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-amber-800 dark:bg-amber-400/[0.1] dark:text-amber-300">
                              Duplicate name
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {person.isSelf ? 'Your identity in shared expenses' : 'Available in Split and Lend'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setEditingId(person.id); setEditingName(person.name); }}
                        aria-label={`Rename ${person.name}`}
                        className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                      >
                        <Pencil size={16} />
                      </button>
                      {!person.isSelf && (
                        <button
                          type="button"
                          onClick={() => void remove(person.id, person.name)}
                          aria-label={`Remove ${person.name}`}
                          className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
