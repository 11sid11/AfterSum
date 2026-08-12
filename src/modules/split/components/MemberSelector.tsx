/**
 * MemberSelector.
 *
 * Multi-select list of people with an "active" toggle for
 * each. Used by the Add Expense form to pick participants
 * and by the group Settings page to manage members.
 *
 * V1 only requires selecting participants (the active flag
 * is hidden on the Add Expense page). The Settings page
 * passes `showActive` to expose the toggle.
 */

import { useMemo } from 'react';
import clsx from 'clsx';
import type { Person } from '@db/schema';

export interface MemberSelectorProps {
  people: Person[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  /** Show a per-row `active` switch (Settings page). */
  showActive?: boolean;
  activeIds?: string[];
  onActiveChange?: (id: string, active: boolean) => void;
}

export function MemberSelector({
  people,
  selectedIds,
  onChange,
  disabled,
  showActive,
  activeIds,
  onActiveChange,
}: MemberSelectorProps) {
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const active = useMemo(() => new Set(activeIds ?? selectedIds), [activeIds, selectedIds]);

  return (
    <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
      {people.length === 0 && (
        <li className="px-3 py-2 text-sm text-slate-500">No people yet. Add some in Settings.</li>
      )}
      {people.map((p) => {
        const isSelected = selected.has(p.id);
        const isActive = active.has(p.id);
        return (
          <li key={p.id} className="flex items-center gap-3 px-3 py-2">
            <label className="flex flex-1 cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={isSelected}
                disabled={disabled}
                onChange={(e) => {
                  if (e.target.checked) {
                    onChange([...selectedIds, p.id]);
                  } else {
                    onChange(selectedIds.filter((id) => id !== p.id));
                  }
                }}
                aria-label={`Toggle ${p.name}`}
              />
              <span>
                {p.name}
                {p.isSelf && <span className="ml-1 text-xs text-slate-500">(me)</span>}
              </span>
            </label>
            {showActive && onActiveChange && (
              <button
                type="button"
                onClick={() => onActiveChange(p.id, !isActive)}
                disabled={disabled}
                className={clsx(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium',
                  isActive
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                )}
                aria-pressed={isActive}
              >
                {isActive ? 'Active' : 'Inactive'}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
