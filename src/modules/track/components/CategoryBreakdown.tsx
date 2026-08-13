/**
 * CategoryBreakdown — list of category totals with bars.
 */

import clsx from 'clsx';
import { Money } from '@components/ui';
import { useAppSettings } from '@shared/settings/useSettings';
import type { CategoryTotal } from '../domain/types';

interface CategoryBreakdownProps {
  rows: CategoryTotal[];
  currency: string;
  /** Total denominator for bar widths. Defaults to sum of rows. */
  totalMinor?: number;
  emptyLabel?: string;
  /** Undefined means no category filter; null represents uncategorised. */
  selectedCategoryId?: string | null;
  onSelectCategory?: (categoryId: string | null) => void;
}

export function CategoryBreakdown({
  rows,
  currency,
  totalMinor,
  emptyLabel = 'No spending yet',
  selectedCategoryId,
  onSelectCategory,
}: CategoryBreakdownProps) {
  const settings = useAppSettings();
  const hide = settings?.hideAmounts ?? false;
  const total = totalMinor ?? rows.reduce((sum, row) => sum + row.totalMinor, 0);

  if (rows.length === 0) {
    return <p className="px-1 py-3 text-sm text-slate-500">{emptyLabel}</p>;
  }

  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {rows.map((row) => {
        const categoryId = row.categoryId ?? null;
        const selected = selectedCategoryId !== undefined && selectedCategoryId === categoryId;
        const pct = total > 0 ? Math.min(100, Math.round((row.totalMinor / total) * 100)) : 0;
        const content = (
          <>
            <div className="mb-1 flex min-w-0 items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate font-medium">{row.categoryName}</span>
              <span className="shrink-0 text-slate-600 dark:text-slate-300">
                <Money value={{ amountMinor: row.totalMinor, currency }} hide={hide} />
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-brand-500 dark:bg-brand-400"
                style={{ width: `${pct}%` }}
                aria-hidden="true"
              />
            </div>
          </>
        );

        return (
          <li key={row.categoryId ?? '__uncategorised__'} className="py-1">
            {onSelectCategory ? (
              <button
                type="button"
                onClick={() => onSelectCategory(categoryId)}
                aria-pressed={selected}
                className={clsx(
                  'w-full rounded-xl px-2 py-2 text-left transition-colors',
                  selected
                    ? 'bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-950/30 dark:ring-brand-800'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
                )}
              >
                {content}
              </button>
            ) : (
              <div className="px-1 py-2">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
