import { useMemo, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Button, Input, Modal, Select, useToast } from '@components/ui';
import { usePeople } from '../queries';
import { personRepository } from '../repository';

interface PersonFieldProps {
  value?: string;
  onChange: (personId: string | undefined) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
}

/**
 * Person selector for flows where creating the missing person should not
 * require leaving the task. Creation still goes through personRepository,
 * so the same identity and uniqueness rules apply everywhere.
 */
export function PersonField({
  value,
  onChange,
  label = 'Person',
  error,
  disabled = false,
}: PersonFieldProps) {
  const people = usePeople();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [createError, setCreateError] = useState<string>();
  const [creating, setCreating] = useState(false);

  const selectablePeople = useMemo(
    () => (people ?? []).filter((person) => !person.isSelf),
    [people],
  );

  const openCreate = () => {
    setName('');
    setCreateError(undefined);
    setCreateOpen(true);
  };

  const closeCreate = () => {
    if (creating) return;
    setCreateOpen(false);
    setName('');
    setCreateError(undefined);
  };

  const createPerson = async (event: React.FormEvent) => {
    event.preventDefault();
    const candidate = name.trim();
    if (!candidate || creating) return;

    setCreating(true);
    setCreateError(undefined);
    try {
      const created = await personRepository.create({ name: candidate });
      onChange(created.id);
      setCreateOpen(false);
      setName('');
      toast.show(`${created.name} added and selected`, { variant: 'success' });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not add person');
    } finally {
      setCreating(false);
    }
  };

  if (people === undefined) {
    return (
      <Select
        name="person"
        label={label}
        value=""
        options={[]}
        placeholder="Loading people…"
        disabled
        error={error}
      />
    );
  }

  return (
    <div className="space-y-2">
      {selectablePeople.length > 0 ? (
        <>
          <Select
            name="person"
            label={label}
            value={value ?? ''}
            onChange={(event) => onChange(event.target.value || undefined)}
            options={selectablePeople.map((person) => ({ value: person.id, label: person.name }))}
            placeholder="Choose a person"
            disabled={disabled}
            error={error}
          />
          <button
            type="button"
            onClick={openCreate}
            disabled={disabled}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-300 dark:hover:bg-brand-400/[0.08]"
          >
            <UserPlus size={14} />
            Add new person
          </button>
        </>
      ) : (
        <div>
          <label className="label">{label}</label>
          <div className="rounded-[15px] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 dark:border-white/[0.12] dark:bg-white/[0.025]">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-400/[0.12] dark:text-brand-200">
                <UserPlus size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">No saved people yet</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Add the person you are lending to or borrowing from. They will also be available in Split.
                </p>
                <Button type="button" size="sm" className="mt-3" onClick={openCreate} disabled={disabled}>
                  <UserPlus size={14} /> Add person
                </Button>
              </div>
            </div>
          </div>
          {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}

      <Modal open={createOpen} onClose={closeCreate} title="Add person" className="max-w-md">
        <form className="space-y-4" onSubmit={(event) => void createPerson(event)}>
          <div>
            <Input
              name="new-person-name"
              label="Name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (createError) setCreateError(undefined);
              }}
              hint="Names are shared across Split and Lend and must be unique."
              error={createError}
              maxLength={120}
              autoFocus
              disabled={creating}
              placeholder="Rahul"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closeCreate} disabled={creating}>Cancel</Button>
            <Button type="submit" disabled={creating || !name.trim()}>
              {creating ? 'Adding…' : 'Add and select'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
