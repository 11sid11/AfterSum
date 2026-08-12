/**
 * Group settings.
 *
 * Edit name / description / currency, manage members
 * (add/remove/active), and archive or delete the group.
 */

import { useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  Input,
  Spinner,
  Textarea,
  useToast,
  Modal,
} from '@components/ui';
import { useSplitGroup, useSplitGroupMembers } from '@modules/split/queries';
import { usePeople, useSelf } from '@shared/people/queries';
import { splitGroupRepository } from '@modules/split/repositories/splitGroupRepository';
import { splitGroupMemberRepository } from '@modules/split/repositories/splitGroupMemberRepository';
import { MemberSelector } from '@modules/split/components/MemberSelector';
import { useAppSettings } from '@shared/settings/useSettings';
import { UNDO_TIMEOUT_MS } from '@app/constants';

export function SplitGroupSettingsPage() {
  const params = useParams({ from: '/split/group/$groupId/settings' });
  const groupId = params.groupId;
  const navigate = useNavigate();
  const group = useSplitGroup(groupId);
  const members = useSplitGroupMembers(groupId, true);
  const people = usePeople();
  const self = useSelf();
  const toast = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Member management
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (group) {
      setName(group.name);
      setDescription(group.description ?? '');
      setCurrency(group.currency);
    }
  }, [group]);

  useEffect(() => {
    if (members) {
      setActiveIds(members.filter((m) => m.active).map((m) => m.personId));
    }
  }, [members]);

  if (!group || members === undefined || !people || !self) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  const memberPersonIds = new Set(members.map((m) => m.personId));
  const memberPeople = people.filter((p) => memberPersonIds.has(p.id));
  const candidatePeople = people.filter((p) => !memberPersonIds.has(p.id));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await splitGroupRepository.update(groupId, {
        name: name.trim(),
        description: description.trim() || undefined,
        currency,
      });
      // Member changes are applied via a separate button to
      // keep the "Save" intent unambiguous.
      setSaved(true);
      toast.show('Saved', { variant: 'success' });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Failed to save', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMembers = async () => {
    setSaving(true);
    try {
      await splitGroupMemberRepository.replaceAllForGroup(groupId, activeIds);
      toast.show('Members updated', { variant: 'success' });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Failed to update members', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (group.archived) {
      await splitGroupRepository.unarchive(groupId);
      toast.show('Group unarchived', { variant: 'success' });
    } else {
      await splitGroupRepository.archive(groupId);
      toast.show('Group archived', { variant: 'success' });
    }
  };

  const handleDelete = async () => {
    await splitGroupRepository.softDelete(groupId);
    toast.show('Group deleted', {
      action: { label: 'Undo', onClick: () => void splitGroupRepository.restore(groupId) },
      duration: UNDO_TIMEOUT_MS,
    });
    setConfirmDelete(false);
    navigate({ to: '/split' });
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Settings</h1>
        <button
          type="button"
          onClick={() => navigate({ to: '/split/group/$groupId', params: { groupId } })}
          className="text-sm text-brand-600 hover:underline"
        >
          Back
        </button>
      </div>

      <Card>
        <form className="space-y-3" onSubmit={handleSave}>
          <Input
            label="Name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            required
          />
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setSaved(false);
            }}
          />
          <div className="space-y-1">
            <label className="label">Currency</label>
            <select
              className="input h-11"
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value);
                setSaved(false);
              }}
            >
              {['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'AED'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving || (!saved && !name.trim())}>
              {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <Button size="sm" variant="secondary" onClick={handleSaveMembers} disabled={saving}>
            Save members
          </Button>
        </CardHeader>
        {memberPeople.length === 0 && candidatePeople.length === 0 ? (
          <p className="text-sm text-slate-500">No people to add yet.</p>
        ) : (
          <div className="space-y-3">
            <MemberSelector
              people={memberPeople}
              selectedIds={activeIds}
              onChange={setActiveIds}
              showActive
              activeIds={activeIds}
              onActiveChange={(id, active) => {
                setActiveIds((cur) =>
                  active ? Array.from(new Set([...cur, id])) : cur.filter((x) => x !== id),
                );
              }}
            />
            {candidatePeople.length > 0 && (
              <details className="rounded-xl border border-slate-200 dark:border-slate-700">
                <summary className="cursor-pointer px-3 py-2 text-sm">Add people</summary>
                <div className="px-3 pb-3">
                  <MemberSelector
                    people={candidatePeople}
                    selectedIds={[]}
                    onChange={(ids) => {
                      // Additions are staged; require Save to commit.
                      setActiveIds((cur) => Array.from(new Set([...cur, ...ids])));
                    }}
                  />
                </div>
              </details>
            )}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Archive</CardTitle>
          <Button variant="secondary" onClick={handleArchive}>
            {group.archived ? 'Unarchive' : 'Archive'}
          </Button>
        </CardHeader>
        <p className="text-sm text-slate-500">
          {group.archived
            ? 'This group is archived. Unarchive to start adding new expenses.'
            : 'Archive to hide the group from the dashboard. History is preserved.'}
        </p>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delete</CardTitle>
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            Delete group
          </Button>
        </CardHeader>
        <p className="text-sm text-slate-500">
          Soft-deletes the group and all its expenses. Undo is available from the toast.
        </p>
      </Card>

      {confirmDelete && (
        <Modal open onClose={() => setConfirmDelete(false)} title="Delete group?">
          <p className="text-sm text-slate-500">
            Are you sure you want to delete "{group.name}"? You can undo from the toast.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// keep live refs for typecheck noise
void useAppSettings;
