import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { personRepository } from '@shared/people/repository';
import { usePeople } from '@shared/people/queries';
import { Card, Button, Input, EmptyState, Spinner, useToast } from '@components/ui';
import { Plus, Trash2, User, Pencil, Users } from 'lucide-react';

export function PeoplePage() {
  const people = usePeople();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const toast = useToast();

  const duplicateByName = (candidate: string, exceptId?: string) =>
    people?.find((person) => person.id !== exceptId && person.name.trim().toLocaleLowerCase() === candidate.trim().toLocaleLowerCase());

  const add = async () => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const duplicate = duplicateByName(cleanName);
    if (duplicate) {
      toast.show(`${duplicate.name} is already in People.`, { variant: 'error' });
      return;
    }
    await personRepository.create({ name: cleanName });
    setName('');
    setAdding(false);
    toast.show('Person added');
  };

  const saveEdit = async () => {
    if (!editingId || !editingName.trim()) return;
    const cleanName = editingName.trim();
    const duplicate = duplicateByName(cleanName, editingId);
    if (duplicate) {
      toast.show(`${duplicate.name} already uses that name.`, { variant: 'error' });
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
      toast.show(`${personName} removed`, { action: { label: 'Undo', onClick: async () => personRepository.restore(id) } });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not remove person', { variant: 'error' });
    }
  };

  if (people === undefined) return <Spinner />;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">People</h1>
          <p className="text-xs text-slate-500">Reusable people for Split trips and Lend.</p>
        </div>
        {!adding && <Button size="sm" className="shrink-0" onClick={() => setAdding(true)}><Plus size={16} /> Add</Button>}
      </header>

      <Card>
        <div className="flex items-start gap-3">
          <Users size={19} className="mt-0.5 shrink-0 text-brand-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Need a group?</p>
            <p className="mt-0.5 text-xs text-slate-500">Create a trip in Split, then choose any saved people. No separate group setup is needed here.</p>
          </div>
          <Button size="sm" variant="secondary" className="shrink-0" onClick={() => navigate({ to: '/split' })}>Split</Button>
        </div>
      </Card>

      {adding && (
        <Card>
          <Input autoFocus label="Name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} onKeyDown={(event) => {
            if (event.key === 'Enter') void add();
            if (event.key === 'Escape') { setAdding(false); setName(''); }
          }} />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setAdding(false); setName(''); }}>Cancel</Button>
            <Button onClick={() => void add()} disabled={!name.trim()}>Save</Button>
          </div>
        </Card>
      )}

      {people.length === 0 ? (
        <Card><EmptyState title="No people yet" description="Add people so you can split expenses and record lending." icon={<User size={32} />} /></Card>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {people.map((person) => (
              <li key={person.id} className="px-4 py-3">
                {editingId === person.id ? (
                  <div className="space-y-3 sm:flex sm:items-end sm:gap-2 sm:space-y-0">
                    <div className="min-w-0 flex-1">
                      <Input label="Name" value={editingName} onChange={(event) => setEditingName(event.target.value)} autoFocus maxLength={120} onKeyDown={(event) => {
                        if (event.key === 'Enter') void saveEdit();
                        if (event.key === 'Escape') { setEditingId(null); setEditingName(''); }
                      }} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditingName(''); }}>Cancel</Button>
                      <Button size="sm" onClick={() => void saveEdit()} disabled={!editingName.trim()}>Save</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{person.name.slice(0, 1).toUpperCase()}</div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{person.name}{person.isSelf && <span className="ml-1 text-xs text-slate-500">(you)</span>}</p></div>
                    <button type="button" onClick={() => { setEditingId(person.id); setEditingName(person.name); }} aria-label={`Rename ${person.name}`} className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Pencil size={16} /></button>
                    {!person.isSelf && <button type="button" onClick={() => void remove(person.id, person.name)} aria-label={`Remove ${person.name}`} className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"><Trash2 size={16} /></button>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
