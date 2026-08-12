/**
 * Manage Track categories.
 *
 * Shows two sections: Expense and Income. Each row has
 * inline actions to rename, archive/unarchive, or delete.
 * Categories that have transactions attached are protected
 * from hard deletion.
 */

import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { ArrowLeft, Plus, Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { Card, Button, Input, useToast, Spinner } from '@components/ui';
import { trackCategoryRepository } from '@modules/track/repositories/trackCategoryRepository';
import { useTrackCategories } from '@modules/track/queries';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDB } from '@db/database';
import type { TrackCategoryType, TrackCategory } from '@db/schema';
import { TrackCategoryInputSchema, type TrackCategoryInput } from '@modules/track/domain/validation';

type AddFormValues = Pick<TrackCategoryInput, 'name' | 'type' | 'icon'>;

const AddFormSchema = TrackCategoryInputSchema.pick({ name: true, type: true, icon: true });

export function TrackCategoriesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [type, setType] = useState<TrackCategoryType>('expense');
  const [adding, setAdding] = useState(false);
  const categories = useTrackCategories(undefined, true); // include archived

  // Count of active transactions per category to warn before delete.
  const usage = useLiveQuery(async () => {
    const all = await getDB().trackTransactions.toArray();
    const map = new Map<string, number>();
    for (const t of all) {
      if (t.deletedAt || !t.categoryId) continue;
      map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + 1);
    }
    return map;
  }, []);

  const form = useForm({
    defaultValues: { name: '', type, icon: 'circle' } as AddFormValues,
    validators: { onChange: AddFormSchema },
    onSubmit: async ({ value }) => {
      try {
        await trackCategoryRepository.create({
          name: value.name.trim(),
          type: value.type,
          icon: value.icon || undefined,
        });
        toast.show('Category added');
        form.reset();
        setAdding(false);
      } catch (err) {
        toast.show(err instanceof Error ? err.message : 'Could not save', { variant: 'error' });
      }
    },
  });

  if (categories === undefined) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner />
      </div>
    );
  }

  const onArchive = async (c: TrackCategory) => {
    await trackCategoryRepository.setArchived(c.id, !c.archived);
    toast.show(c.archived ? 'Restored from archive' : 'Archived');
  };

  const onDelete = async (c: TrackCategory) => {
    const used = usage?.get(c.id) ?? 0;
    if (used > 0) {
      toast.show(`${c.name} has ${used} transaction${used === 1 ? '' : 's'}. Archive instead.`, {
        variant: 'error',
      });
      return;
    }
    await trackCategoryRepository.softDelete(c.id);
    toast.show(`${c.name} deleted`, {
      action: { label: 'Undo', onClick: () => trackCategoryRepository.restore(c.id) },
    });
  };

  const renderSection = (sectionType: TrackCategoryType, label: string) => {
    const rows = categories.filter((c) => c.type === sectionType);
    return (
      <Card padded={false}>
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="section-title">{label}</h2>
          {!adding && sectionType === type && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setType(sectionType);
                setAdding(true);
              }}
            >
              <Plus size={16} /> Add
            </Button>
          )}
        </div>
        {adding && type === sectionType && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void form.handleSubmit();
            }}
            className="border-t border-slate-100 p-4 dark:border-slate-800"
          >
            <div className="mb-2 flex gap-2">
              {(['expense', 'income'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setType(t);
                    form.setFieldValue('type', t);
                  }}
                  aria-pressed={type === t}
                  className={
                    type === t
                      ? 'rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white'
                      : 'rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300'
                  }
                >
                  {t}
                </button>
              ))}
            </div>
            <form.Field name="name">
              {(field) => (
                <Input
                  label="Name"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  autoFocus
                />
              )}
            </form.Field>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setAdding(false);
                  form.reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!form.state.values.name.trim()}>
                Save
              </Button>
            </div>
          </form>
        )}
        {rows.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-slate-500">No {label.toLowerCase()} yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${c.archived ? 'text-slate-400 line-through' : 'font-medium'}`}>
                    {c.name}
                  </p>
                  {c.archived && <p className="text-xs text-slate-400">archived</p>}
                </div>
                <button
                  type="button"
                  onClick={() => onArchive(c)}
                  aria-label={c.archived ? `Unarchive ${c.name}` : `Archive ${c.name}`}
                  className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {c.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(c)}
                  aria-label={`Delete ${c.name}`}
                  className="rounded-full p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate({ to: '/track' })}
          aria-label="Back"
          className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-semibold">Categories</h1>
      </header>

      {renderSection('expense', 'Expense')}
      {renderSection('income', 'Income')}
    </div>
  );
}
