/**
 * People management page.
 */

import { useState } from 'react';
import { personRepository } from '@shared/people/repository';
import { usePeople } from '@shared/people/queries';
import { Card, Button, Input, EmptyState, Spinner, useToast } from '@components/ui';
import { Plus, Trash2, User, Pencil } from 'lucide-react';

export function PeoplePage() {
  const people = usePeople();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const toast = useToast();

  const add = async () => {
    if (!name.trim()) return;
    await personRepository.create({ name: name.trim() });
    setName('');
    setAdding(false);
    toast.show('Person added');
  };

  const saveEdit = async () => {
    if (!editingId || !editingName.trim()) return;
    try {
      await personRepository.update(editingId, { name: editingName.trim() });
      toast.show('Name updated', { variant: 'success' });
      setEditingId(null);
      setEditingName('');
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not update person', { variant: 'error' });
    }
  };

  const remove = async (id: string, n: string) => {
    if (id === 'self') return;
    try {
      await personRepository.softDelete(id);
      toast.show(`${n} removed`, {
        action: {
          label: 'Undo',
          onClick: async () => {
            await personRepository.restore(id);
          },
        },
      });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not remove person', { variant: 'error' });
    }
  };

  if (people === undefined) return <Spinner />;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">People</h1>
          <p className="text-xs text-slate-500">Shared identities used by Split and Lend.</p>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus size={16} /> Add
          </Button>
        )}
      </header>

      {adding && (
        <Card>
          <Input
            autoFocus
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void add();
              if (e.key === 'Escape') {
                setAdding(false);
                setName('');
              }
            }}
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setAdding(false); setName(''); }}>Cancel</Button>
            <Button onClick={() => void add()} disabled={!name.trim()}>Save</Button>
          </div>
        </Card>
      )}

      {people.length === 0 ? (
        <Card>
          <EmptyState
            title="No people yet"
            description="Add people so you can split expenses and record lending."
            icon={<User size={32} />}
          />
        </Card>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {people.map((p) => (
              <li key={p.id} className="px-4 py-3">
                {editingId === p.id ? (
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Input
                        label="Name"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                        maxLength={120}
                      />
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditingName(''); }}>Cancel</Button>
                    <Button size="sm" onClick={() => void saveEdit()} disabled={!editingName.trim()}>Save</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {p.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {p.name}
                        {p.isSelf && <span className="ml-1 text-xs text-slate-500">(you)</span>}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setEditingId(p.id); setEditingName(p.name); }}
                      aria-label={`Rename ${p.name}`}
                      className="grid min-h-11 min-w-11 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Pencil size={16} />
                    </button>
                    {!p.isSelf && (
                      <button
                        type="button"
                        onClick={() => void remove(p.id, p.name)}
                        aria-label={`Remove ${p.name}`}
                        className="grid min-h-11 min-w-11 place-items-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
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
