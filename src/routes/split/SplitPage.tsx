/** Split dashboard: active trips, archived trips, and trip creation. */

import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { Button, Card, EmptyState, Modal, Input, Spinner, useToast } from '@components/ui';
import { ArchiveRestore, Plus, Users, X } from 'lucide-react';
import { useSplitDashboard } from '@modules/split/queries';
import { useArchivedSplitGroups } from '@modules/split/queries/useArchivedSplitGroups';
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><h1 className="text-xl font-semibold">Split</h1><p className="text-xs text-slate-500">Trips are your shared-expense groups.</p></div>
        <Button onClick={() => setCreateOpen(true)} size="sm" disabled={!ready} className="shrink-0"><Plus size={16} /> New trip</Button>
      </div>

      {!ready ? <div className="flex justify-center py-10"><Spinner /></div> : groups.length === 0 ? (
        <EmptyState icon={<Users size={32} />} title="No active trips" description={archivedGroups.length > 0 ? 'Start a new trip or restore one from Archived trips below.' : 'Create a trip to split shared expenses with friends.'} action={<Button onClick={() => setCreateOpen(true)}><Plus size={16} /> Create trip</Button>} />
      ) : (
        <ul className="space-y-2">{groups.map((item) => <li key={item.group.id}><GroupCard group={item.group} yourNet={item.yourNet} expenseCount={item.expenseCount} /></li>)}</ul>
      )}

      {ready && archivedGroups.length > 0 && (
        <Card padded={false}>
          <details>
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Archived trips ({archivedGroups.length})</summary>
            <ul className="border-t border-slate-100 dark:border-slate-800">
              {archivedGroups.map((group) => (
                <li key={group.id} className="flex min-w-0 items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-800">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{group.name}</p><p className="text-xs text-slate-500">History is preserved</p></div>
                  <Button size="sm" variant="secondary" className="shrink-0" onClick={() => void unarchive(group.id)}><ArchiveRestore size={15} /> Restore</Button>
                </li>
              ))}
            </ul>
          </details>
        </Card>
      )}

      {createOpen && self && settings && <CreateTripModal defaultCurrency={settings.defaultCurrency} selfPersonId={self.id} onClose={() => setCreateOpen(false)} onCreated={(groupId) => { setCreateOpen(false); navigate({ to: '/split/group/$groupId', params: { groupId } }); }} />}
    </div>
  );
}

interface CreateTripModalProps { defaultCurrency: string; selfPersonId: string; onClose: () => void; onCreated: (groupId: string) => void; }

function CreateTripModal({ defaultCurrency, selfPersonId, onClose, onCreated }: CreateTripModalProps) {
  const people = usePeople();
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
    const candidate = newPersonName.trim();
    if (!candidate) return;
    const normalized = candidate.toLocaleLowerCase();
    const existing = selectablePeople.find((person) => person.name.trim().toLocaleLowerCase() === normalized);
    if (existing) {
      setSelectedMemberIds((current) => current.includes(existing.id) ? current : [...current, existing.id]);
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return setError('Trip name is required');
    const membersToAttach = new Set(selectedMemberIds);
    const peopleToCreate = [...pendingPeople];
    const inlineName = newPersonName.trim();
    if (inlineName) {
      const normalized = inlineName.toLocaleLowerCase();
      const existing = selectablePeople.find((person) => person.name.trim().toLocaleLowerCase() === normalized);
      if (existing) membersToAttach.add(existing.id);
      else if (!peopleToCreate.some((personName) => personName.toLocaleLowerCase() === normalized)) peopleToCreate.push(inlineName);
    }
    setSubmitting(true);
    setError(undefined);
    try {
      const group = await splitGroupRepository.create({ name: name.trim(), description: description.trim() || undefined, currency });
      await splitGroupMemberRepository.getOrCreate(group.id, selfPersonId);
      for (const personId of membersToAttach) await splitGroupMemberRepository.getOrCreate(group.id, personId);
      for (const personName of peopleToCreate) {
        const person = await personRepository.create({ name: personName });
        await splitGroupMemberRepository.getOrCreate(group.id, person.id);
      }
      onCreated(group.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create trip');
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="New trip">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-3">
          <Input label="Trip name" name="name" value={name} onChange={(event) => setName(event.target.value)} autoFocus placeholder="Goa Trip" required />
          <Input label="Description" name="description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional" />
          <div className="space-y-1"><label className="label">Currency</label><select className="input h-11" value={currency} onChange={(event) => setCurrency(event.target.value)} aria-label="Currency">{['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'AED'].map((code) => <option key={code} value={code}>{code}</option>)}</select></div>
        </div>

        <section className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <div><h2 className="text-sm font-semibold">Who's in this trip?</h2><p className="mt-1 text-xs text-slate-500">You're included automatically. Select saved people or add someone new.</p></div>
          {people === undefined ? <div className="flex justify-center py-3"><Spinner /></div> : selectablePeople.length > 0 ? <MemberSelector people={selectablePeople} selectedIds={selectedMemberIds} onChange={setSelectedMemberIds} disabled={submitting} /> : <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:bg-slate-800/50">No other saved people yet.</p>}
          <div className="flex items-end gap-2"><div className="min-w-0 flex-1"><Input label="Add someone new" name="new-person" value={newPersonName} onChange={(event) => setNewPersonName(event.target.value)} placeholder="Rahul" disabled={submitting} /></div><Button type="button" variant="secondary" onClick={addPendingPerson} disabled={submitting || !newPersonName.trim()}>Add</Button></div>
          {pendingPeople.length > 0 && <div className="flex flex-wrap gap-2">{pendingPeople.map((personName) => <span key={personName} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm dark:bg-slate-800">{personName}<button type="button" onClick={() => setPendingPeople((current) => current.filter((item) => item !== personName))} className="rounded-full p-0.5 text-slate-500" aria-label={`Remove ${personName}`}><X size={14} /></button></span>)}</div>}
        </section>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button><Button type="submit" disabled={submitting || !name.trim() || people === undefined}>{submitting ? 'Creating…' : 'Create trip'}</Button></div>
      </form>
    </Modal>
  );
}
