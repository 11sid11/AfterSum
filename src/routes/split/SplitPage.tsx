/** Split dashboard: active trips, archived trips, and trip creation. */

import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import {
  Button,
  Card,
  CurrencyPicker,
  EmptyState,
  Input,
  Modal,
  Spinner,
  useCelebration,
  useToast,
} from '@components/ui';
import { ArchiveRestore, Plus, Users, X } from 'lucide-react';
import { useSplitDashboard } from '@modules/split/queries';
import { useArchivedSplitGroups } from '@modules/split/queries/useArchivedSplitGroups';
import { GroupCard } from '@modules/split/components/GroupCard';
import { MemberSelector } from '@modules/split/components/MemberSelector';
import { splitGroupRepository } from '@modules/split/repositories/splitGroupRepository';
import { splitGroupMemberRepository } from '@modules/split/repositories/splitGroupMemberRepository';
import { normalizePersonName, personNameKey } from '@shared/people/domain';
import { usePeople, useSelf } from '@shared/people/queries';
import { personRepository } from '@shared/people/repository';
import { useAppSettings } from '@shared/settings/useSettings';

export function SplitPage() {
  const navigate = useNavigate();
  const groups = useSplitDashboard();
  const archivedGroups = useArchivedSplitGroups();
  const self = useSelf();
  const settings = useAppSettings();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const ready = groups !== undefined && archivedGroups !== undefined && self !== undefined && settings !== undefined;

  const unarchive = async (groupId: string) => {
    try {
      await splitGroupRepository.unarchive(groupId);
      toast.show('Trip restored', { variant: 'success' });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not restore trip', { variant: 'error' });
    }
  };

  return (
    <div className="space-y-7">
      <header className="flex min-w-0 items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.65rem] font-semibold tracking-[-0.045em] text-slate-950 dark:text-white">Split</h1>
          <p className="mt-1 text-xs text-slate-500">Trips, shared expenses and settlements.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm" disabled={!ready} className="shrink-0"><Plus size={15} /> New trip</Button>
      </header>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-[-0.02em]">Active trips</h2>
            <p className="mt-1 text-xs text-slate-500">Open a trip to add expenses or settle up.</p>
          </div>
          {ready && groups.length > 0 && (
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {groups.length} active
            </span>
          )}
        </div>
        {!ready ? <div className="flex justify-center py-10"><Spinner /></div> : groups.length === 0 ? (
          <Card><EmptyState icon={<Users size={26} />} title="No active trips" description={archivedGroups.length > 0 ? 'Start a new trip or restore one from Archived trips below.' : 'Create a trip to split shared expenses with friends.'} action={<Button onClick={() => setCreateOpen(true)}><Plus size={16} /> Create trip</Button>} /></Card>
        ) : (
          <ul className="stagger-list grid gap-3 md:grid-cols-2">{groups.map((item) => <li key={item.group.id}><GroupCard group={item.group} yourNet={item.yourNet} expenseCount={item.expenseCount} /></li>)}</ul>
        )}
      </section>

      {ready && archivedGroups.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-[-0.02em]">Archived</h2>
          <Card padded={false} className="overflow-hidden">
            <details>
              <summary className="cursor-pointer px-4 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 sm:px-5">Show archived trips <span className="font-normal text-slate-400">({archivedGroups.length})</span></summary>
              <ul className="border-t border-slate-200/75 dark:border-white/[0.07]">
                {archivedGroups.map((group) => (
                  <li key={group.id} className="flex min-w-0 items-center gap-3 border-b border-slate-200/75 px-4 py-3.5 last:border-b-0 dark:border-white/[0.07] sm:px-5">
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{group.name}</p><p className="mt-0.5 text-xs text-slate-500">History is preserved</p></div>
                    <Button size="sm" variant="secondary" className="shrink-0" onClick={() => void unarchive(group.id)}><ArchiveRestore size={14} /> Restore</Button>
                  </li>
                ))}
              </ul>
            </details>
          </Card>
        </section>
      )}

      {createOpen && self && settings && <CreateTripModal defaultCurrency={settings.defaultCurrency} selfPersonId={self.id} onClose={() => setCreateOpen(false)} onCreated={(groupId) => { setCreateOpen(false); navigate({ to: '/split/group/$groupId', params: { groupId } }); }} />}
    </div>
  );
}

interface CreateTripModalProps { defaultCurrency: string; selfPersonId: string; onClose: () => void; onCreated: (groupId: string) => void; }

function CreateTripModal({ defaultCurrency, selfPersonId, onClose, onCreated }: CreateTripModalProps) {
  const people = usePeople();
  const { celebrate } = useCelebration();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [newPersonName, setNewPersonName] = useState('');
  const [pendingPeople, setPendingPeople] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const selectablePeople = useMemo(() => (people ?? []).filter((person) => person.id !== selfPersonId && !person.isSelf), [people, selfPersonId]);

  const addPendingPerson = () => {
    const candidate = normalizePersonName(newPersonName);
    if (!candidate) return;
    const candidateKey = personNameKey(candidate);
    const existing = selectablePeople.find((person) => personNameKey(person.name) === candidateKey);
    if (existing) {
      setError(`${existing.name} is already saved. Select them above instead.`);
      return;
    }
    if (pendingPeople.some((personName) => personNameKey(personName) === candidateKey)) {
      setError(`${candidate} is already being added.`);
      return;
    }
    setPendingPeople((current) => [...current, candidate]);
    setNewPersonName('');
    setError(undefined);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return setError('Trip name is required');

    const peopleToCreate = [...pendingPeople];
    const inlineName = normalizePersonName(newPersonName);
    if (inlineName) {
      const inlineKey = personNameKey(inlineName);
      const existing = selectablePeople.find((person) => personNameKey(person.name) === inlineKey);
      if (existing) {
        setError(`${existing.name} is already saved. Select them above instead.`);
        return;
      }
      if (!peopleToCreate.some((personName) => personNameKey(personName) === inlineKey)) {
        peopleToCreate.push(inlineName);
      }
    }

    setSubmitting(true);
    setError(undefined);
    try {
      const group = await splitGroupRepository.create({ name: name.trim(), description: description.trim() || undefined, currency });
      await splitGroupMemberRepository.getOrCreate(group.id, selfPersonId);
      for (const personId of selectedMemberIds) await splitGroupMemberRepository.getOrCreate(group.id, personId);
      for (const personName of peopleToCreate) {
        const person = await personRepository.create({ name: personName });
        await splitGroupMemberRepository.getOrCreate(group.id, person.id);
      }
      celebrate({ kind: 'added', message: 'Trip created' });
      onCreated(group.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create trip');
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="New trip">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <section className="space-y-3">
          <Input label="Trip name" name="name" value={name} onChange={(event) => setName(event.target.value)} autoFocus placeholder="Goa Trip" required />
          <Input label="Description" name="description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional" />
          <CurrencyPicker value={currency} onChange={setCurrency} />
        </section>

        <section className="space-y-3 border-t border-slate-200/75 pt-5 dark:border-white/[0.07]">
          <div><h2 className="text-sm font-semibold tracking-[-0.01em]">Who's in this trip?</h2><p className="mt-1 text-xs leading-5 text-slate-500">You're included automatically. Select saved people or add someone with a new, unique name.</p></div>
          {people === undefined ? <div className="flex justify-center py-3"><Spinner /></div> : selectablePeople.length > 0 ? <MemberSelector people={selectablePeople} selectedIds={selectedMemberIds} onChange={setSelectedMemberIds} disabled={submitting} /> : <p className="rounded-[14px] bg-slate-100 px-3 py-2.5 text-sm text-slate-500 dark:bg-white/[0.05]">No other saved people yet.</p>}
          <div className="flex items-end gap-2"><div className="min-w-0 flex-1"><Input label="Add someone new" name="new-person" value={newPersonName} onChange={(event) => { setNewPersonName(event.target.value); if (error) setError(undefined); }} hint="If they already exist, select them above instead." placeholder="Rahul" disabled={submitting} /></div><Button type="button" variant="secondary" onClick={addPendingPerson} disabled={submitting || !newPersonName.trim()}>Add</Button></div>
          {pendingPeople.length > 0 && <div className="flex flex-wrap gap-2">{pendingPeople.map((personName) => <span key={personName} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium shadow-[0_1px_2px_rgb(15_23_42/0.025)] dark:border-white/[0.07] dark:bg-white/[0.05]">{personName}<button type="button" onClick={() => setPendingPeople((current) => current.filter((item) => item !== personName))} className="rounded-full p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white" aria-label={`Remove ${personName}`}><X size={13} /></button></span>)}</div>}
        </section>
        {error && <p className="rounded-[14px] bg-rose-500/[0.08] px-3 py-2.5 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button><Button type="submit" disabled={submitting || !name.trim() || people === undefined}>{submitting ? 'Creating…' : 'Create trip'}</Button></div>
      </form>
    </Modal>
  );
}
