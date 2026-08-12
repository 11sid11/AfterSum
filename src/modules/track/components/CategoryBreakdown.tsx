/**
 * CategoryBreakdown — list of category totals with bars.
 */

import { Money } from '@components/ui';
import { useAppSettings } from '@shared/settings/useSettings';
import type { CategoryTotal } from '../domain/types';

interface CategoryBreakdownProps {
  rows: CategoryTotal[];
  currency: string;
  /** Total denominator for bar widths. Defaults to sum of rows. */
  totalMinor?: number;
  emptyLabel?: string;
}

export function CategoryBreakdown({
  rows,
  currency,
  totalMinor,
  emptyLabel = 'No spending yet',
}: CategoryBreakdownProps) {
  const settings = useAppSettings();
  const hide = settings?.hideAmounts ?? false;
  const total = totalMinor ?? rows.reduce((a, b) => a + b.totalMinor, 0);

  if (rows.length === 0) {
    return <p className="px-1 py-3 text-sm text-slate-500">{emptyLabel}</p>;
  }

  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {rows.map((r) => {
        const pct = total > 0 ? Math.min(100, Math.round((r.totalMinor / total) * 100)) : 0;
        return (
          <li key={r.categoryId ?? '__uncategorised__'} className="px-1 py-3">
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span className="truncate font-medium">{r.categoryName}</span>
              <span className="text-slate-600 dark:text-slate-300">
                <Money value={{ amountMinor: r.totalMinor, currency }} hide={hide} />
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-brand-500 dark:bg-brand-400"
                style={{ width: `${pct}%` }}
                aria-hidden="true"
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
