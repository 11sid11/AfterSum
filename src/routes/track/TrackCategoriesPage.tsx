/** Manage Track expense and income categories. */

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
  const categories = useTrackCategories(undefined, true);
  const usage = useLiveQuery(async () => {
    const all = await getDB().trackTransactions.toArray();
    const map = new Map<string, number>();
    for (const transaction of all) {
      if (transaction.deletedAt || !transaction.categoryId) continue;
      map.set(transaction.categoryId, (map.get(transaction.categoryId) ?? 0) + 1);
    }
    return map;
  }, []);

  const form = useForm({
    defaultValues: { name: '', type, icon: 'circle' } as AddFormValues,
    validators: { onChange: AddFormSchema },
    onSubmit: async ({ value }) => {
      try {
        await trackCategoryRepository.create({ name: value.name.trim(), type: value.type, icon: value.icon || undefined });
        toast.show('Category added');
        form.reset();
        setAdding(false);
      } catch (err) {
        toast.show(err instanceof Error ? err.message : 'Could not save', { variant: 'error' });
      }
    },
  });

  if (categories === undefined) return <div className="grid min-h-[40vh] place-items-center"><Spinner /></div>;

  const startAdd = (sectionType: TrackCategoryType) => {
    setType(sectionType);
    form.setFieldValue('type', sectionType);
    form.setFieldValue('name', '');
    setAdding(true);
  };

  const onArchive = async (category: TrackCategory) => {
    await trackCategoryRepository.setArchived(category.id, !category.archived);
    toast.show(category.archived ? 'Restored from archive' : 'Archived');
  };

  const onDelete = async (category: TrackCategory) => {
    const used = usage?.get(category.id) ?? 0;
    if (used > 0) {
      toast.show(`${category.name} has ${used} transaction${used === 1 ? '' : 's'}. Archive instead.`, { variant: 'error' });
      return;
    }
    await trackCategoryRepository.softDelete(category.id);
    toast.show(`${category.name} deleted`, { action: { label: 'Undo', onClick: () => trackCategoryRepository.restore(category.id) } });
  };

  const renderSection = (sectionType: TrackCategoryType, label: string) => {
    const rows = categories.filter((category) => category.type === sectionType);
    return (
      <Card padded={false}>
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="section-title">{label}</h2>
          {!adding && <Button size="sm" variant="ghost" onClick={() => startAdd(sectionType)}><Plus size={16} /> Add</Button>}
        </div>
        {adding && type === sectionType && (
          <form onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); void form.handleSubmit(); }} className="border-t border-slate-100 p-4 dark:border-slate-800">
            <p className="mb-3 text-xs text-slate-500">New {label.toLocaleLowerCase()} category</p>
            <form.Field name="name">
              {(field) => <Input label="Name" name={field.name} value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} autoFocus />}
            </form.Field>
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => { setAdding(false); form.reset(); }}>Cancel</Button>
              <Button type="submit" disabled={!form.state.values.name.trim()}>Save</Button>
            </div>
          </form>
        )}
        {rows.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-slate-500">No {label.toLocaleLowerCase()} categories yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((category) => (
              <li key={category.id} className="flex min-w-0 items-center gap-2 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${category.archived ? 'text-slate-400 line-through' : 'font-medium'}`}>{category.name}</p>
                  {category.archived && <p className="text-xs text-slate-400">Archived</p>}
                </div>
                <button type="button" onClick={() => void onArchive(category)} aria-label={category.archived ? `Unarchive ${category.name}` : `Archive ${category.name}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">{category.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}</button>
                <button type="button" onClick={() => void onDelete(category)} aria-label={`Delete ${category.name}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"><Trash2 size={16} /></button>
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
        <button type="button" onClick={() => navigate({ to: '/track' })} aria-label="Back" className="grid h-11 w-11 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><ArrowLeft size={18} /></button>
        <h1 className="text-lg font-semibold">Categories</h1>
      </header>
      {renderSection('expense', 'Expense')}
      {renderSection('income', 'Income')}
    </div>
  );
}
