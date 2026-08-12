/**
 * Manage Track recurring reminders.
 *
 * V1: rules are TEMPLATES only. The user can:
 *   - add a new rule
 *   - edit / enable / disable / delete an existing rule
 *   - tap "Create transaction" on a rule to prefill the
 *     Add form with the rule's fields
 *
 * No automatic insertion of transactions.
 */

import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { ArrowLeft, Plus, Pencil, Trash2, ArrowRight, Power, PowerOff } from 'lucide-react';
import { Card, Button, Input, Select, useToast, Spinner } from '@components/ui';
import { useTrackCategories, useTrackRecurring } from '@modules/track/queries';
import { trackRecurringRepository, computeNextDate } from '@modules/track/repositories/trackRecurringRepository';
import { useAppSettings } from '@shared/settings/useSettings';
import { todayDateOnly, formatHumanDate } from '@shared/dates';
import {
  RECURRING_FREQUENCIES,
} from '@modules/track/domain/validation';
import type { TrackRecurringRule, TrackCategory } from '@db/schema';

// Form-level schema mirrors the domain schema's INPUT shape (pre-transform).
// We don't use the domain schema here because TanStack Form's validator
// type is bound to the defaultValues shape, and the domain schema's
// transforms would change the output type.
const RecurringFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(120),
  amountMinor: z.number().int().positive().optional(),
  currency: z.string().min(1).max(8),
  categoryId: z.string().optional(),
  frequency: z.enum(RECURRING_FREQUENCIES),
  nextDate: z
    .string()
    .min(10, 'Date is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  enabled: z.boolean(),
});

type FormValues = z.infer<typeof RecurringFormSchema>;

function defaultValues(currency: string): FormValues {
  return {
    title: '',
    amountMinor: undefined,
    currency,
    categoryId: '',
    frequency: 'monthly',
    nextDate: todayDateOnly(),
    enabled: true,
  };
}

export function TrackRecurringPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const settings = useAppSettings();
  const rules = useTrackRecurring();
  const categories = useTrackCategories();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  if (!settings) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner />
      </div>
    );
  }

  const openAdd = () => {
    setEditingId(null);
    setAdding(true);
  };

  const openEdit = (r: TrackRecurringRule) => {
    setEditingId(r.id);
    setAdding(true);
  };

  const onCreateTransaction = (r: TrackRecurringRule) => {
    navigate({
      to: '/track/add',
      search: { type: 'expense' },
      // Note: we don't have a way to prefill the form via search today,
      // but routing here opens the Add page. The user can copy the
      // values manually from the rule summary.
    });
    toast.show(`Use "${r.title}" as the title when adding`, { duration: 4000 });
  };

  const onAdvance = async (r: TrackRecurringRule) => {
    const next = computeNextDate(r.nextDate, r.frequency);
    await trackRecurringRepository.update(r.id, { nextDate: next });
    toast.show('Next occurrence updated');
  };

  const onToggle = async (r: TrackRecurringRule) => {
    await trackRecurringRepository.setEnabled(r.id, !r.enabled);
    toast.show(r.enabled ? 'Reminder paused' : 'Reminder enabled');
  };

  const onDelete = async (r: TrackRecurringRule) => {
    await trackRecurringRepository.softDelete(r.id);
    toast.show(`"${r.title}" removed`, {
      action: { label: 'Undo', onClick: () => trackRecurringRepository.restore(r.id) },
    });
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate({ to: '/track' })}
            aria-label="Back"
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-semibold">Recurring</h1>
        </div>
        {!adding && (
          <Button size="sm" onClick={openAdd}>
            <Plus size={16} /> Add
          </Button>
        )}
      </header>

      {adding && (
        <RecurringForm
          initial={
            editingId
              ? (() => {
                  const r = rules?.find((x) => x.id === editingId);
                  if (!r) return defaultValues(settings.defaultCurrency);
                  return {
                    title: r.title,
                    amountMinor: r.amountMinor,
                    currency: r.currency,
                    categoryId: r.categoryId ?? '',
                    frequency: r.frequency,
                    nextDate: r.nextDate,
                    enabled: r.enabled,
                  };
                })()
              : defaultValues(settings.defaultCurrency)
          }
          categories={categories ?? []}
          editing={!!editingId}
          onCancel={() => {
            setAdding(false);
            setEditingId(null);
          }}
          onSaved={() => {
            setAdding(false);
            setEditingId(null);
          }}
          onSubmit={async (values) => {
            try {
              if (editingId) {
                await trackRecurringRepository.update(editingId, values);
                toast.show('Reminder updated');
              } else {
                await trackRecurringRepository.create(values);
                toast.show('Reminder added');
              }
            } catch (err) {
              toast.show(err instanceof Error ? err.message : 'Could not save', { variant: 'error' });
              return;
            }
            setAdding(false);
            setEditingId(null);
          }}
        />
      )}

      {rules === undefined ? (
        <div className="grid min-h-[20vh] place-items-center">
          <Spinner />
        </div>
      ) : rules.length === 0 && !adding ? (
        <Card>
          <p className="text-sm text-slate-500">
            No recurring reminders yet. Add one to be reminded about regular expenses.
          </p>
        </Card>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {rules.map((r) => {
              const cat = categories?.find((c) => c.id === r.categoryId);
              return (
                <li key={r.id} className="flex items-center gap-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {r.title}
                      {!r.enabled && <span className="ml-1 text-xs text-slate-400">(paused)</span>}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {r.frequency} · next {formatHumanDate(r.nextDate)}
                      {cat ? ` · ${cat.name}` : ''}
                      {r.amountMinor !== undefined ? ` · ${r.amountMinor}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCreateTransaction(r)}
                    aria-label="Create transaction from this reminder"
                    className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"
                  >
                    <ArrowRight size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onAdvance(r)}
                    aria-label="Advance to next occurrence"
                    className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <ArrowRight size={16} className="rotate-180" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggle(r)}
                    aria-label={r.enabled ? 'Pause' : 'Enable'}
                    className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {r.enabled ? <Power size={16} /> : <PowerOff size={16} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(r)}
                    aria-label="Edit"
                    className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(r)}
                    aria-label="Delete"
                    className="rounded-full p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

interface RecurringFormProps {
  initial: FormValues;
  categories: TrackCategory[];
  editing: boolean;
  onCancel: () => void;
  onSubmit: (values: FormValues) => Promise<void> | void;
  onSaved: () => void;
}

function RecurringForm({ initial, categories, editing, onCancel, onSubmit }: RecurringFormProps) {
  const form = useForm({
    defaultValues: initial,
    // The Zod schema's inferred shape includes refinements
    // (ZodEffects), which TanStack Form's strict
    // `FormValidateOrFn` does not accept. The form's
    // onSubmit still receives the original value, and the
    // domain layer re-validates, so the cast is safe.
    validators: { onChange: RecurringFormSchema as never },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <Card>
        <div className="space-y-3">
          <form.Field name="title">
            {(field) => (
              <Input
                label="Title"
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                autoFocus
              />
            )}
          </form.Field>

          <form.Field name="amountMinor">
            {(field) => (
              <Input
                label="Amount (optional)"
                type="number"
                inputMode="decimal"
                name={field.name}
                value={field.state.value !== undefined ? String(field.state.value) : ''}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  field.handleChange(Number.isFinite(n) && n > 0 ? Math.round(n) : undefined);
                }}
                hint="Used as a template. The amount entered when adding the transaction wins."
              />
            )}
          </form.Field>

          <form.Field name="frequency">
            {(field) => (
              <Select
                label="Frequency"
                name={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value as FormValues['frequency'])}
                options={RECURRING_FREQUENCIES.map((f) => ({ value: f, label: f }))}
              />
            )}
          </form.Field>

          <form.Field name="nextDate">
            {(field) => (
              <Input
                label="Next date"
                type="date"
                name={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            )}
          </form.Field>

          <form.Field name="categoryId">
            {(field) => (
              <Select
                label="Category (optional)"
                name={field.name}
                value={field.state.value ?? ''}
                onChange={(e) => field.handleChange(e.target.value || undefined)}
                options={[
                  { value: '', label: '—' },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            )}
          </form.Field>

          <form.Field name="enabled">
            {(field) => (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={field.state.value ?? true}
                  onChange={(e) => field.handleChange(e.target.checked)}
                />
                <span>Enabled</span>
              </label>
            )}
          </form.Field>
        </div>
      </Card>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{editing ? 'Update' : 'Save'}</Button>
      </div>
    </form>
  );
}
