/**
 * Split dashboard.
 *
 * Lists every active group with the current user's net
 * position per group, plus a "Create group" CTA. Per the
 * work.md §78 empty state, an empty list shows a friendly
 * placeholder.
 */

import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Button, EmptyState, Modal, Input, Spinner } from '@components/ui';
import { Users, Plus } from 'lucide-react';
import { useSplitDashboard } from '@modules/split/queries';
import { GroupCard } from '@modules/split/components/GroupCard';
import { splitGroupRepository } from '@modules/split/repositories/splitGroupRepository';
import { splitGroupMemberRepository } from '@modules/split/repositories/splitGroupMemberRepository';
import { useSelf } from '@shared/people/queries';
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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Group name is required');
      return;
    }
    setSubmitting(true);
    setError(undefined);
    try {
      const group = await splitGroupRepository.create({
        name: name.trim(),
        description: description.trim() || undefined,
        currency,
      });
      // Auto-add the self person as a member so the dashboard
      // net is meaningful from the start.
      await splitGroupMemberRepository.getOrCreate(group.id, selfPersonId);
      onCreated(group.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="New group">
      <form className="space-y-3" onSubmit={handleSubmit}>
        <Input
          label="Name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          placeholder="Goa Trip"
          error={error}
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
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !name.trim()}>
            {submitting ? 'Creating…' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
