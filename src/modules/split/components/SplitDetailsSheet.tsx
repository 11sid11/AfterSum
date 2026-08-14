import { Button, Modal } from '@components/ui';
import type { Person, SplitMethod } from '@db/schema';
import { computeEqualShares } from '../domain/splits';
import { SplitAllocationEditor } from './SplitAllocationEditor';
import { SplitMethodSelector } from './SplitMethodSelector';
import { minorToDecimal } from '@shared/money';
import { Check } from 'lucide-react';

interface SplitDetailsSheetProps {
  open: boolean;
  onClose: () => void;
  people: Person[];
  currency: string;
  amountMinor: number;
  payerId?: string;
  onPayerChange: (personId: string) => void;
  participantIds: string[];
  onParticipantsChange: (personIds: string[]) => void;
  method: SplitMethod;
  onMethodChange: (method: SplitMethod) => void;
  allocation: Record<string, string>;
  onAllocationChange: (values: Record<string, string>) => void;
  itemized: boolean;
  rememberDefault: boolean;
  onRememberDefaultChange: (next: boolean) => void;
}

export function SplitDetailsSheet({
  open,
  onClose,
  people,
  currency,
  amountMinor,
  payerId,
  onPayerChange,
  participantIds,
  onParticipantsChange,
  method,
  onMethodChange,
  allocation,
  onAllocationChange,
  itemized,
  rememberDefault,
  onRememberDefaultChange,
}: SplitDetailsSheetProps) {
  const selectedPeople = people.filter((person) => participantIds.includes(person.id));

  const setMethod = (next: SplitMethod) => {
    onMethodChange(next);
    onAllocationChange(defaultAllocation(next, participantIds, amountMinor, currency));
    if (next === 'exact') onRememberDefaultChange(false);
  };

  const togglePerson = (personId: string) => {
    const selected = participantIds.includes(personId);
    if (selected && participantIds.length === 1) return;
    const next = selected
      ? participantIds.filter((id) => id !== personId)
      : [...participantIds, personId];
    onParticipantsChange(next);
    onAllocationChange(defaultAllocation(method, next, amountMinor, currency, allocation));
  };

  return (
    <Modal open={open} onClose={onClose} title="Split details" className="max-w-lg">
      <div className="space-y-5">
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Paid by</h3>
          <div className="flex flex-wrap gap-2">
            {people.map((person) => (
              <ChoiceChip
                key={person.id}
                label={person.isSelf ? 'You' : person.name}
                selected={payerId === person.id}
                onClick={() => onPayerChange(person.id)}
              />
            ))}
          </div>
        </section>

        {itemized ? (
          <div className="rounded-2xl border border-brand-200 bg-brand-50/70 p-4 text-sm text-brand-900 dark:border-brand-900/50 dark:bg-brand-950/20 dark:text-brand-100">
            This expense is itemized. Each item's people decide the final shares, so only the payer is set here.
          </div>
        ) : (
          <>
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Split between</h3>
                <button
                  type="button"
                  onClick={() => {
                    const ids = people.map((person) => person.id);
                    onParticipantsChange(ids);
                    onAllocationChange(defaultAllocation(method, ids, amountMinor, currency, allocation));
                  }}
                  className="min-h-10 px-2 text-xs font-semibold text-brand-600 hover:underline"
                >
                  Everyone
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {people.map((person) => (
                  <ChoiceChip
                    key={person.id}
                    label={person.isSelf ? 'You' : person.name}
                    selected={participantIds.includes(person.id)}
                    onClick={() => togglePerson(person.id)}
                  />
                ))}
              </div>
              <p className="text-xs text-slate-500">{participantIds.length} of {people.length} selected</p>
            </section>

            <section className="space-y-2.5">
              <h3 className="text-sm font-semibold">How to split</h3>
              <SplitMethodSelector value={method} onChange={setMethod} />
              {method !== 'equal' && selectedPeople.length > 0 && (
                <SplitAllocationEditor
                  method={method}
                  participants={selectedPeople}
                  currency={currency}
                  totalAmountMinor={amountMinor}
                  values={allocation}
                  onChange={(personId, raw) => onAllocationChange({ ...allocation, [personId]: raw })}
                />
              )}
            </section>

            <button
              type="button"
              disabled={method === 'exact'}
              onClick={() => onRememberDefaultChange(!rememberDefault)}
              className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-slate-200 px-3 py-2 text-left disabled:opacity-50 dark:border-slate-700"
            >
              <span className={rememberDefault ? 'grid h-6 w-6 place-items-center rounded-lg bg-brand-600 text-white' : 'grid h-6 w-6 place-items-center rounded-lg border border-slate-300 dark:border-slate-600'}>
                {rememberDefault && <Check size={14} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Use this split by default for this trip</span>
                <span className="block text-xs text-slate-500">
                  {method === 'exact' ? 'Exact amounts depend on the expense total, so they are not saved as a default.' : 'You can still change it on any expense.'}
                </span>
              </span>
            </button>
          </>
        )}

        <Button block onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
}

function ChoiceChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        selected
          ? 'inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium text-white'
          : 'inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
      }
    >
      {selected && <Check size={14} />}
      {label}
    </button>
  );
}

function defaultAllocation(
  method: SplitMethod,
  participantIds: string[],
  amountMinor: number,
  currency: string,
  previous: Record<string, string> = {},
): Record<string, string> {
  if (method === 'equal') return {};
  const next: Record<string, string> = {};

  if (method === 'shares') {
    for (const id of participantIds) next[id] = previous[id] && Number(previous[id]) > 0 ? previous[id]! : '1';
    return next;
  }

  if (method === 'exact') {
    const amounts = computeEqualShares(Math.max(0, amountMinor), participantIds);
    participantIds.forEach((id, index) => {
      next[id] = previous[id] ?? String(minorToDecimal(amounts[index] ?? 0, currency));
    });
    return next;
  }

  const count = participantIds.length;
  if (count === 0) return next;
  const base = Math.floor((10000 / count)) / 100;
  let assigned = 0;
  participantIds.forEach((id, index) => {
    const value = index === count - 1 ? Number((100 - assigned).toFixed(2)) : base;
    next[id] = previous[id] ?? String(value);
    assigned += value;
  });
  return next;
}
