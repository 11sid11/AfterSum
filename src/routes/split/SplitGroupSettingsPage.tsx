import { useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CurrencyPicker,
  Input,
  Modal,
  Spinner,
  Textarea,
  useToast,
} from '@components/ui';
import { Pause, Play, Repeat2, Split, Trash2 } from 'lucide-react';
import { useSplitGroup } from '@modules/split/queries';
import { splitGroupRepository } from '@modules/split/repositories/splitGroupRepository';
import { SplitCsvImportCard } from '@modules/split/components/SplitCsvImportCard';
import { getDB } from '@db/database';
import { UNDO_TIMEOUT_MS } from '@app/constants';
import { formatHumanDate } from '@shared/dates';

export function SplitGroupSettingsPage() {
  const { groupId } = useParams({ from: '/split/group/$groupId/settings' });
  const navigate = useNavigate();
  const group = useSplitGroup(groupId);
  const activityCount = useLiveQuery(async () => {
    const db = getDB();
    const [expenses, settlements] = await Promise.all([
      db.splitExpenses.where('groupId').equals(groupId).count(),
      db.splitSettlements.where('groupId').equals(groupId).count(),
    ]);
    return expenses + settlements;
  }, [groupId]);
  const toast = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!group) return;
    setName(group.name);
    setDescription(group.description ?? '');
    setCurrency(group.currency);
  }, [group]);

  if (!group || activityCount === undefined) {
    return <div className="flex justify-center py-10"><Spinner /></div>;
  }

  const currencyLocked = activityCount > 0;
  const recurring = group.recurringTemplates ?? [];

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await splitGroupRepository.update(groupId, {
        name: name.trim(),
        description: description.trim() || undefined,
        currency: currencyLocked ? group.currency : currency,
      });
      setSaved(true);
      toast.show('Trip settings saved', { variant: 'success' });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Failed to save', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    try {
      if (group.archived) {
        await splitGroupRepository.unarchive(groupId);
        toast.show('Trip restored', { variant: 'success' });
      } else {
        await splitGroupRepository.archive(groupId);
        toast.show('Trip archived', { variant: 'success' });
        navigate({ to: '/split' });
      }
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not update trip', { variant: 'error' });
    }
  };

  const handleDelete = async () => {
    try {
      await splitGroupRepository.softDelete(groupId);
      toast.show('Trip deleted', {
        action: { label: 'Undo', onClick: () => void splitGroupRepository.restore(groupId) },
        duration: UNDO_TIMEOUT_MS,
      });
      setConfirmDelete(false);
      navigate({ to: '/split' });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not delete trip', { variant: 'error' });
    }
  };

  const clearDefaultSplit = async () => {
    try {
      await splitGroupRepository.setDefaultSplit(groupId, undefined);
      toast.show('Saved split cleared');
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not clear saved split', { variant: 'error' });
    }
  };

  const toggleRecurring = async (templateId: string) => {
    const next = recurring.map((template) =>
      template.id === templateId ? { ...template, enabled: !template.enabled } : template,
    );
    try {
      await splitGroupRepository.setRecurringTemplates(groupId, next);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not update recurring expense', { variant: 'error' });
    }
  };

  const deleteRecurring = async (templateId: string) => {
    const template = recurring.find((item) => item.id === templateId);
    if (!template || !window.confirm(`Stop recurring “${template.title}”? Existing expenses stay unchanged.`)) return;
    try {
      await splitGroupRepository.setRecurringTemplates(
        groupId,
        recurring.filter((item) => item.id !== templateId),
      );
      toast.show('Recurring expense removed');
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not remove recurring expense', { variant: 'error' });
    }
  };

  return (
    <div className="space-y-4 pb-24">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">Trip settings</h1>
          <p className="truncate text-xs text-slate-500">{group.name}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate({ to: '/split/group/$groupId', params: { groupId } })}
          className="min-h-11 shrink-0 px-2 text-sm font-medium text-brand-600 hover:underline"
        >
          Back to trip
        </button>
      </header>

      <Card>
        <form className="space-y-3" onSubmit={handleSave}>
          <Input
            label="Trip name"
            value={name}
            onChange={(event) => { setName(event.target.value); setSaved(false); }}
            required
            maxLength={120}
          />
          <Textarea
            label="Description"
            value={description}
            onChange={(event) => { setDescription(event.target.value); setSaved(false); }}
            maxLength={500}
          />
          <div className="space-y-1">
            {currencyLocked ? (
              <>
                <label className="label">Currency</label>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
                  <p className="text-sm font-semibold">{group.currency}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Locked after expenses or payments are recorded so old amounts are never relabelled.
                  </p>
                </div>
              </>
            ) : (
              <CurrencyPicker value={currency} onChange={(next) => { setCurrency(next); setSaved(false); }} label="Currency" />
            )}
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Participants</CardTitle>
        </CardHeader>
        <p className="text-sm text-slate-500">
          Manage who is in this trip from the <strong>People</strong> tab. Keeping participant changes next to trip activity avoids two competing member lists.
        </p>
        <Button className="mt-3" variant="secondary" onClick={() => navigate({ to: '/split/group/$groupId', params: { groupId } })}>
          Back to trip
        </Button>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saved split</CardTitle>
          <Split size={18} className="text-slate-400" />
        </CardHeader>
        {group.defaultSplit ? (
          <>
            <p className="text-sm text-slate-500">
              New expenses start with {group.defaultSplit.participantIds.length} people using a {group.defaultSplit.splitMethod === 'percentage' ? 'percentage' : group.defaultSplit.splitMethod} split.
            </p>
            <Button className="mt-3" variant="secondary" onClick={() => void clearDefaultSplit()}>
              Clear saved split
            </Button>
          </>
        ) : (
          <p className="text-sm text-slate-500">
            No saved split. You can save Equal, Percent or Shares from the Split details sheet while adding an expense.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recurring expenses</CardTitle>
          <Repeat2 size={18} className="text-slate-400" />
        </CardHeader>
        <p className="text-sm text-slate-500">
          Recurring expenses are generated locally when this trip is opened. No server scheduler is used.
        </p>
        {recurring.length > 0 ? (
          <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {recurring.map((template) => (
              <div key={template.id} className="flex min-w-0 items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{template.title}</p>
                  <p className="truncate text-xs text-slate-500">
                    {template.frequency[0]!.toUpperCase() + template.frequency.slice(1)} · next {formatHumanDate(template.nextDate)}
                    {!template.enabled ? ' · paused' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className="icon-button shrink-0"
                  aria-label={template.enabled ? 'Pause recurring expense' : 'Resume recurring expense'}
                  onClick={() => void toggleRecurring(template.id)}
                >
                  {template.enabled ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button
                  type="button"
                  className="icon-button shrink-0 text-rose-600"
                  aria-label="Remove recurring expense"
                  onClick={() => void deleteRecurring(template.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">Choose a repeat schedule from Expense details when adding an expense.</p>
        )}
      </Card>

      <SplitCsvImportCard groupId={groupId} currency={group.currency} />

      <Card>
        <CardHeader>
          <CardTitle>Archive trip</CardTitle>
          <Button variant="secondary" onClick={() => void handleArchive()}>{group.archived ? 'Restore trip' : 'Archive trip'}</Button>
        </CardHeader>
        <p className="text-sm text-slate-500">Archive hides this trip from the active list while preserving its history. Archived trips can be restored from Split.</p>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delete trip</CardTitle>
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete trip</Button>
        </CardHeader>
        <p className="text-sm text-slate-500">Removes this trip from normal views. Its financial rows remain intact so Undo and backups stay reliable.</p>
      </Card>

      {confirmDelete && (
        <Modal open onClose={() => setConfirmDelete(false)} title="Delete trip?">
          <p className="text-sm text-slate-500">
            Delete “{group.name}”? The trip will disappear from normal views. You can undo from the confirmation message immediately afterward.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => void handleDelete()}>Delete trip</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
