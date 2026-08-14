/** CategoryBreakdown — category totals with tap-to-filter rows. */

import clsx from 'clsx';
import { Money } from '@components/ui';
import { useAppSettings } from '@shared/settings/useSettings';
import type { CategoryTotal } from '../domain/types';

interface CategoryBreakdownProps {
  rows: CategoryTotal[];
  currency: string;
  totalMinor?: number;
  emptyLabel?: string;
  selectedCategoryId?: string | null;
  onSelectCategory?: (categoryId: string | null) => void;
}

export function CategoryBreakdown({ rows, currency, totalMinor, emptyLabel = 'No spending yet', selectedCategoryId, onSelectCategory }: CategoryBreakdownProps) {
  const settings = useAppSettings();
  const hide = settings?.hideAmounts ?? false;
  const total = totalMinor ?? rows.reduce((sum, row) => sum + row.totalMinor, 0);

  if (rows.length === 0) return <p className="px-1 py-3 text-sm text-slate-500">{emptyLabel}</p>;

  return (
    <ul className="space-y-1">
      {rows.map((row) => {
        const categoryId = row.categoryId ?? null;
        const selected = selectedCategoryId !== undefined && selectedCategoryId === categoryId;
        const pct = total > 0 ? Math.min(100, Math.round((row.totalMinor / total) * 100)) : 0;
        const content = (
          <>
            <div className="mb-2 flex min-w-0 items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">{row.categoryName}</span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-700 dark:text-slate-200"><Money value={{ amountMinor: row.totalMinor, currency }} hide={hide} /></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full bg-brand-500 dark:bg-brand-400" style={{ width: `${pct}%` }} aria-hidden="true" />
              </div>
              <span className="w-8 text-right text-[11px] tabular-nums text-slate-400">{pct}%</span>
            </div>
          </>
        );

        return (
          <li key={row.categoryId ?? '__uncategorised__'}>
            {onSelectCategory ? (
              <button
                type="button"
                onClick={() => onSelectCategory(categoryId)}
                aria-pressed={selected}
                className={clsx(
                  'w-full rounded-2xl px-3 py-3 text-left transition-[background-color,box-shadow,transform] duration-200 active:scale-[0.99]',
                  selected
                    ? 'bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-950/[0.35] dark:ring-brand-800'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/[0.55]',
                )}
              >
                {content}
              </button>
            ) : (
              <div className="px-2 py-3">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
