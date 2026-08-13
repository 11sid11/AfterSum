/**
 * Split dashboard.
 *
 * Lists every active group with the current user's net
 * position per group, plus a "Create group" CTA. Group
 * creation includes member selection so a group is usable
 * immediately after it is created.
 */

import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { Button, EmptyState, Modal, Input, Spinner } from '@components/ui';
import { Users, Plus, X } from 'lucide-react';
import { useSplitDashboard } from '@modules/split/queries';
import { GroupCard } from '@modules/split/components/GroupCard';
import { MemberSelector } from '@modules/split/components/MemberSelector';
import { splitGroupRepository } from '@modules/split/repositories/splitGroupRepository';
import { splitGroupMemberRepository } from '@modules/split/repositories/splitGroupMemberRepository';
import { usePeople, useSelf } from '@shared/people/queries';
import { personRepository } from '@shared/people/repository';
import { useAppSettings } from '@shared/settings/useSettings';

export function SplitPage() {
  const navigate = useNavigate();
  const groups = useSplitDashboard();
  const self = useSelf();
  const settings = useAppSettings();
  const [createOpen, setCreateOpen] = useState(false);

  const defaultCurrency = settings?.defaultCurrency ?? 'INR';
  const ready = groups !== undefined && self !== undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Split</h1>
        <Button
          onClick={() => setCreateOpen(true)}
          size="sm"
          disabled={!self}
          aria-label="Create group"
        >
          <Plus size={16} />
          New group
        </Button>
      </div>

      {!ready ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<Users size={32} />}
          title="No groups yet"
          description="Create a trip or group to split shared expenses."
          action={
            <Button onClick={() => setCreateOpen(true)} disabled={!self}>
              <Plus size={16} />
              Create group
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {groups.map((item) => (
            <li key={item.group.id}>
              <GroupCard
                group={item.group}
                yourNet={item.yourNet}
                expenseCount={item.expenseCount}
              />
            </li>
          ))}
        </ul>
      )}

      {createOpen && self && (
        <CreateGroupModal
          defaultCurrency={defaultCurrency}
          selfPersonId={self.id}
          onClose={() => setCreateOpen(false)}
          onCreated={(groupId) => {
            setCreateOpen(false);
            navigate({ to: '/split/group/$groupId', params: { groupId } });
          }}
        />
      )}
    </div>
  );
}

interface CreateGroupModalProps {
  defaultCurrency: string;
  selfPersonId: string;
  onClose: () => void;
  onCreated: (groupId: string) => void;
}

function CreateGroupModal({ defaultCurrency, selfPersonId, onClose, onCreated }: CreateGroupModalProps) {
  const people = usePeople();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [newPersonName, setNewPersonName] = useState('');
  const [pendingPeople, setPendingPeople] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const selectablePeople = useMemo(
    () => (people ?? []).filter((person) => person.id !== selfPersonId && !person.isSelf),
    [people, selfPersonId],
  );

  const addPendingPerson = () => {
    const candidate = newPersonName.trim();
    if (!candidate) return;

    const normalized = candidate.toLocaleLowerCase();
    const existing = selectablePeople.find((person) => person.name.trim().toLocaleLowerCase() === normalized);
    if (existing) {
      if (!selectedMemberIds.includes(existing.id)) {
        setSelectedMemberIds((current) => [...current, existing.id]);
      }
      setNewPersonName('');
      setError(undefined);
      return;
    }

    if (pendingPeople.some((personName) => personName.toLocaleLowerCase() === normalized)) {
      setError(`${candidate} is already being added`);
      return;
    }

    setPendingPeople((current) => [...current, candidate]);
    setNewPersonName('');
    setError(undefined);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Group name is required');
      return;
    }

    // Treat a name still sitting in the "Add someone new" field as
    // intentional input. The user should not have to tap Add before
    // tapping Create group.
    const membersToAttach = new Set(selectedMemberIds);
    const peopleToCreate = [...pendingPeople];
    const inlineName = newPersonName.trim();
    if (inlineName) {
      const normalized = inlineName.toLocaleLowerCase();
      const existing = selectablePeople.find(
        (person) => person.name.trim().toLocaleLowerCase() === normalized,
      );
      if (existing) {
        membersToAttach.add(existing.id);
      } else if (!peopleToCreate.some((personName) => personName.toLocaleLowerCase() === normalized)) {
        peopleToCreate.push(inlineName);
      }
    }

    setSubmitting(true);
    setError(undefined);
    try {
      const group = await splitGroupRepository.create({
        name: name.trim(),
        description: description.trim() || undefined,
        currency,
      });

      // The current user is always part of a Split group.
      await splitGroupMemberRepository.getOrCreate(group.id, selfPersonId);

      for (const personId of membersToAttach) {
        await splitGroupMemberRepository.getOrCreate(group.id, personId);
      }

      for (const personName of peopleToCreate) {
        const person = await personRepository.create({ name: personName });
        await splitGroupMemberRepository.getOrCreate(group.id, person.id);
      }

      onCreated(group.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="New group">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-3">
          <Input
            label="Group name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="Goa Trip"
            required
          />
          <Input
            label="Description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
          />
          <div className="space-y-1">
            <label className="label">Currency</label>
            <select
              className="input h-11"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              aria-label="Currency"
            >
              {['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'AED'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <section className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold">Who's in this group?</h2>
            <p className="mt-1 text-xs text-slate-500">
              You're included automatically. Select existing people or add someone new.
            </p>
          </div>

          {people === undefined ? (
            <div className="flex justify-center py-3">
              <Spinner />
            </div>
          ) : selectablePeople.length > 0 ? (
            <MemberSelector
              people={selectablePeople}
              selectedIds={selectedMemberIds}
              onChange={setSelectedMemberIds}
              disabled={submitting}
            />
          ) : (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:bg-slate-800/50">
              No other saved people yet.
            </p>
          )}

          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Input
                label="Add someone new"
                name="new-person"
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                placeholder="Rahul"
                disabled={submitting}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={addPendingPerson}
              disabled={submitting || !newPersonName.trim()}
            >
              Add
            </Button>
          </div>

          {pendingPeople.length > 0 && (
            <div className="flex flex-wrap gap-2" aria-label="New people to add">
              {pendingPeople.map((personName) => (
                <span
                  key={personName}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm dark:bg-slate-800"
                >
                  {personName}
                  <button
                    type="button"
                    onClick={() =>
                      setPendingPeople((current) => current.filter((name) => name !== personName))
                    }
                    disabled={submitting}
                    className="rounded-full p-0.5 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    aria-label={`Remove ${personName}`}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !name.trim() || people === undefined}>
            {submitting ? 'Creating…' : 'Create group'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
