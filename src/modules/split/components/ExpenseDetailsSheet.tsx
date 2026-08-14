import { Button, CurrencyPicker, DateInput, Input, Modal, Money, MoneyInput, Textarea } from '@components/ui';
import { Check, Plus, Trash2 } from 'lucide-react';
import type {
  Person,
  SplitExpenseCategory,
  SplitItem,
  SplitRecurringFrequency,
} from '@db/schema';
import { SPLIT_CATEGORIES } from '../domain/categories';
import { SplitCategoryIcon } from './SplitCategoryIcon';
import { newId } from '@shared/ids';

export type SplitRepeatValue = 'never' | SplitRecurringFrequency;

interface ExpenseDetailsSheetProps {
  open: boolean;
  onClose: () => void;
  currency: string;
  amountMinor: number;
  category: SplitExpenseCategory;
  onCategoryChange: (category: SplitExpenseCategory) => void;
  date: string;
  onDateChange: (date: string) => void;
  note: string;
  onNoteChange: (note: string) => void;
  repeat: SplitRepeatValue;
  onRepeatChange: (value: SplitRepeatValue) => void;
  foreignEnabled: boolean;
  onForeignEnabledChange: (enabled: boolean) => void;
  originalCurrency: string;
  onOriginalCurrencyChange: (currency: string) => void;
  originalAmountMinor: number;
  onOriginalAmountChange: (amountMinor: number) => void;
  exchangeRate: string;
  onExchangeRateChange: (value: string) => void;
  people: Person[];
  defaultParticipantIds: string[];
  itemized: boolean;
  onItemizedChange: (enabled: boolean) => void;
  items: SplitItem[];
  onItemsChange: (items: SplitItem[]) => void;
}

const REPEAT_OPTIONS: Array<{ value: SplitRepeatValue; label: string }> = [
  { value: 'never', label: 'Never' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

export function ExpenseDetailsSheet({
  open,
  onClose,
  currency,
  amountMinor,
  category,
  onCategoryChange,
  date,
  onDateChange,
  note,
  onNoteChange,
  repeat,
  onRepeatChange,
  foreignEnabled,
  onForeignEnabledChange,
  originalCurrency,
  onOriginalCurrencyChange,
  originalAmountMinor,
  onOriginalAmountChange,
  exchangeRate,
  onExchangeRateChange,
  people,
  defaultParticipantIds,
  itemized,
  onItemizedChange,
  items,
  onItemsChange,
}: ExpenseDetailsSheetProps) {
  const itemTotal = items.reduce((sum, item) => sum + item.amountMinor, 0);

  const enableItemization = () => {
    onItemizedChange(true);
    if (items.length === 0) {
      onItemsChange([
        {
          id: newId(),
          title: '',
          amountMinor: amountMinor > 0 ? amountMinor : 0,
          participantIds: defaultParticipantIds.length > 0 ? [...defaultParticipantIds] : people.map((person) => person.id),
        },
      ]);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Expense details" className="max-w-lg">
      <div className="space-y-6">
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Category</h3>
          <div className="flex flex-wrap gap-2">
            {SPLIT_CATEGORIES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => onCategoryChange(item.value)}
                aria-pressed={category === item.value}
                className={
                  category === item.value
                    ? 'inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium text-white'
                    : 'inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                }
              >
                {category === item.value && <Check size={14} />}
                <SplitCategoryIcon category={item.value} size={15} />
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <DateInput label="Date" value={date} onChange={onDateChange} />

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Repeats</h3>
          <div className="grid grid-cols-4 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/40">
            {REPEAT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={foreignEnabled && option.value !== 'never'}
                onClick={() => onRepeatChange(option.value)}
                className={
                  repeat === option.value
                    ? 'rounded-lg bg-white px-2 py-2 text-xs font-semibold text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-200'
                    : 'rounded-lg px-2 py-2 text-xs font-medium text-slate-500 disabled:opacity-40'
                }
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            {foreignEnabled
              ? 'Recurring foreign-currency expenses are disabled because AfterSum does not fetch future exchange rates.'
              : 'Recurring expenses are created locally when this trip is opened.'}
          </p>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
            onClick={() => {
              const next = !foreignEnabled;
              onForeignEnabledChange(next);
              if (next && repeat !== 'never') onRepeatChange('never');
            }}
          >
            <span>
              <span className="block text-sm font-semibold">Paid in another currency</span>
              <span className="block text-xs text-slate-500">Optional manual conversion. No exchange-rate service is contacted.</span>
            </span>
            <span className={foreignEnabled ? 'grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-brand-600 text-white' : 'grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-slate-300 dark:border-slate-600'}>
              {foreignEnabled && <Check size={14} />}
            </span>
          </button>
          {foreignEnabled && (
            <div className="space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
              <CurrencyPicker value={originalCurrency} onChange={onOriginalCurrencyChange} label="Paid currency" />
              <MoneyInput value={originalAmountMinor} currency={originalCurrency} onChange={onOriginalAmountChange} label="Paid amount" />
              <Input
                label={`Rate · 1 ${originalCurrency} = ${currency}`}
                inputMode="decimal"
                value={exchangeRate}
                onChange={(event) => onExchangeRateChange(event.target.value)}
                placeholder="e.g. 91.50"
              />
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
                Trip amount: <strong><Money value={{ amountMinor, currency }} /></strong>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Itemize expense</h3>
              <p className="mt-0.5 text-xs text-slate-500">Split individual items between different people.</p>
            </div>
            {!itemized ? (
              <Button size="sm" variant="secondary" onClick={enableItemization}>Itemize</Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => { onItemizedChange(false); onItemsChange([]); }}>Remove</Button>
            )}
          </div>

          {itemized && (
            <div className="space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
              {items.map((item, index) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  index={index}
                  currency={currency}
                  people={people}
                  onChange={(next) => onItemsChange(items.map((value) => value.id === item.id ? next : value))}
                  onRemove={() => onItemsChange(items.filter((value) => value.id !== item.id))}
                />
              ))}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onItemsChange([
                  ...items,
                  {
                    id: newId(),
                    title: '',
                    amountMinor: 0,
                    participantIds: defaultParticipantIds.length > 0 ? [...defaultParticipantIds] : people.map((person) => person.id),
                  },
                ])}
              >
                <Plus size={15} /> Add item
              </Button>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
                <span className="text-slate-500">Items total</span>
                <span className={itemTotal === amountMinor ? 'font-semibold text-emerald-600' : 'font-semibold text-amber-600'}>
                  <Money value={{ amountMinor: itemTotal, currency }} />
                </span>
              </div>
              {itemTotal !== amountMinor && <p className="text-xs text-amber-600">Items must add up to the expense amount before saving.</p>}
            </div>
          )}
        </section>

        <Textarea
          label="Note"
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="Optional note"
          maxLength={1000}
        />

        <Button block onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
}

function ItemRow({
  item,
  index,
  currency,
  people,
  onChange,
  onRemove,
}: {
  item: SplitItem;
  index: number;
  currency: string;
  people: Person[];
  onChange: (next: SplitItem) => void;
  onRemove: () => void;
}) {
  const togglePerson = (personId: string) => {
    const selected = item.participantIds.includes(personId);
    if (selected && item.participantIds.length === 1) return;
    onChange({
      ...item,
      participantIds: selected
        ? item.participantIds.filter((id) => id !== personId)
        : [...item.participantIds, personId],
    });
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Input
            label={`Item ${index + 1}`}
            value={item.title}
            onChange={(event) => onChange({ ...item, title: event.target.value })}
            placeholder="Pizza, drinks…"
            maxLength={120}
          />
        </div>
        <button type="button" onClick={onRemove} className="icon-button mt-6 shrink-0 text-rose-600" aria-label={`Remove item ${index + 1}`}>
          <Trash2 size={16} />
        </button>
      </div>
      <MoneyInput value={item.amountMinor} currency={currency} onChange={(amountMinor) => onChange({ ...item, amountMinor })} label="Amount" />
      <div>
        <p className="mb-2 text-xs font-medium text-slate-500">For</p>
        <div className="flex flex-wrap gap-1.5">
          {people.map((person) => {
            const selected = item.participantIds.includes(person.id);
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => togglePerson(person.id)}
                className={selected ? 'rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white' : 'rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300'}
              >
                {person.isSelf ? 'You' : person.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
