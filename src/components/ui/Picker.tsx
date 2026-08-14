/**
 * Picker (CategoryPicker, PersonPicker, PaymentMethodPicker, CurrencyPicker).
 *
 * Thin wrappers around shared controls that read live data from Dexie
 * via `useLiveQuery`. They are used in forms for Track / Split / Lend.
 */

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, ChevronDown, Search } from 'lucide-react';
import { getDB } from '@db/database';
import { Select } from './Select';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';
import { CURRENCY_OPTIONS } from '@app/constants';
import type { CurrencyCode } from '@shared/money';
import type { PaymentMethod, TrackCategory } from '@db/schema';

export function CategoryPicker({
  value,
  onChange,
  type,
  label = 'Category',
  includeArchived = false,
  error,
  allowEmpty = false,
}: {
  value?: string;
  onChange: (id: string | undefined) => void;
  type?: 'expense' | 'income';
  label?: string;
  includeArchived?: boolean;
  error?: string;
  allowEmpty?: boolean;
}) {
  const categories = useLiveQuery<TrackCategory[]>(
    async () => {
      const all = await getDB().trackCategories.toArray();
      return all
        .filter((c) => !c.deletedAt && (includeArchived || !c.archived))
        .filter((c) => (type ? c.type === type : true))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    [type, includeArchived],
  );
  return (
    <Select
      name="category"
      label={label}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
      options={[
        ...(allowEmpty ? [{ value: '', label: '—' }] : []),
        ...(categories ?? []).map((c) => ({ value: c.id, label: c.name })),
      ]}
      error={error}
    />
  );
}

export function PersonPicker({
  value,
  onChange,
  label = 'Person',
  error,
  excludeSelf,
  includeAll = false,
  allLabel = 'Anyone',
}: {
  value?: string;
  onChange: (id: string | undefined) => void;
  label?: string;
  error?: string;
  excludeSelf?: boolean;
  includeAll?: boolean;
  allLabel?: string;
}) {
  const people = useLiveQuery(
    async () => {
      const all = await getDB().people.toArray();
      return all
        .filter((p) => !p.deletedAt)
        .filter((p) => (excludeSelf ? !p.isSelf : true))
        .sort((a, b) => {
          if (a.isSelf && !b.isSelf) return -1;
          if (b.isSelf && !a.isSelf) return 1;
          return a.name.localeCompare(b.name);
        });
    },
    [excludeSelf],
  );
  return (
    <Select
      name="person"
      label={label}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
      options={[
        ...(includeAll ? [{ value: '', label: allLabel }] : []),
        ...(people ?? []).map((p) => ({ value: p.id, label: p.name + (p.isSelf ? ' (me)' : '') })),
      ]}
      error={error}
    />
  );
}

export function PaymentMethodPicker({
  value,
  onChange,
  label = 'Payment method',
  error,
  allowEmpty = true,
}: {
  value?: PaymentMethod;
  onChange: (m: PaymentMethod | undefined) => void;
  label?: string;
  error?: string;
  allowEmpty?: boolean;
}) {
  return (
    <Select
      name="paymentMethod"
      label={label}
      value={value ?? ''}
      onChange={(e) => onChange((e.target.value || undefined) as PaymentMethod | undefined)}
      options={[
        ...(allowEmpty ? [{ value: '', label: '—' }] : []),
        { value: 'cash', label: 'Cash' },
        { value: 'upi', label: 'UPI' },
        { value: 'card', label: 'Card' },
        { value: 'other', label: 'Other' },
      ]}
      error={error}
    />
  );
}

export function CurrencyPicker({
  value,
  onChange,
  label = 'Currency',
  error,
}: {
  value: CurrencyCode;
  onChange: (c: CurrencyCode) => void;
  label?: string;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = CURRENCY_OPTIONS.find((currency) => currency.code === value);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return CURRENCY_OPTIONS;
    return CURRENCY_OPTIONS.filter((currency) =>
      `${currency.code} ${currency.label} ${currency.symbol}`.toLocaleLowerCase().includes(needle),
    );
  }, [query]);

  return (
    <div className="space-y-1">
      <label className="label">{label}</label>
      <input type="hidden" name="currency" value={value} />
      <Button
        type="button"
        variant="secondary"
        block
        className="justify-between"
        onClick={() => {
          setQuery('');
          setOpen(true);
        }}
      >
        <span className="min-w-0 truncate text-left">
          {selected ? `${selected.symbol}  ${selected.code} — ${selected.label}` : value}
        </span>
        <ChevronDown size={16} className="shrink-0 text-slate-400" />
      </Button>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <Modal open={open} onClose={() => setOpen(false)} title="Choose currency" className="max-w-md">
        <div className="space-y-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search currency or code"
            aria-label="Search currency or code"
            leadingIcon={<Search size={16} />}
            autoFocus
          />
          <div className="max-h-[50vh] space-y-1 overflow-y-auto">
            {filtered.map((currency) => (
              <button
                key={currency.code}
                type="button"
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                onClick={() => {
                  onChange(currency.code);
                  setOpen(false);
                }}
              >
                <span className="w-10 shrink-0 text-sm font-semibold">{currency.code}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-600 dark:text-slate-300">
                  {currency.label}
                </span>
                <span className="shrink-0 text-sm text-slate-400">{currency.symbol}</span>
                {currency.code === value && <Check size={16} className="shrink-0 text-brand-600" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-slate-500">No matching currencies.</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
