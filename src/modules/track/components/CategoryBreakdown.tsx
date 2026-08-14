/** CategoryBreakdown — tactile category cards with tap-to-filter behavior. */

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

const badgeClasses = [
  'bg-[#fff0eb] text-[#a54431] dark:bg-rose-400/[0.1] dark:text-rose-300',
  'bg-brand-100 text-brand-700 dark:bg-brand-400/[0.12] dark:text-brand-200',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/[0.11] dark:text-emerald-200',
  'bg-amber-100 text-amber-700 dark:bg-amber-400/[0.1] dark:text-amber-200',
];

export function CategoryBreakdown({ rows, currency, totalMinor, emptyLabel = 'No spending yet', selectedCategoryId, onSelectCategory }: CategoryBreakdownProps) {
  const settings = useAppSettings();
  const hide = settings?.hideAmounts ?? false;
  const total = totalMinor ?? rows.reduce((sum, row) => sum + row.totalMinor, 0);

  if (rows.length === 0) return <p className="px-1 py-3 text-sm text-slate-500">{emptyLabel}</p>;

  return (
    <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {rows.map((row, index) => {
        const categoryId = row.categoryId ?? null;
        const selected = selectedCategoryId !== undefined && selectedCategoryId === categoryId;
        const pct = total > 0 ? Math.min(100, Math.round((row.totalMinor / total) * 100)) : 0;
        const content = (
          <>
            <div className={clsx('grid h-9 w-9 place-items-center rounded-full text-xs font-semibold', badgeClasses[index % badgeClasses.length])}>
              {(row.categoryName.trim().charAt(0) || '?').toLocaleUpperCase()}
            </div>
            <div className="mt-3 min-w-0">
              <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{row.categoryName}</p>
              <p className="mt-1 truncate text-[17px] font-semibold tracking-[-0.025em] tabular-nums text-slate-950 dark:text-white">
                <Money value={{ amountMinor: row.totalMinor, currency }} hide={hide} />
              </p>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.08em] text-slate-500">{pct}% of spend</p>
            </div>
          </>
        );

        return (
          <li key={row.categoryId ?? '__uncategorised__'} className="min-w-[138px] max-w-[160px] flex-1 snap-start">
            {onSelectCategory ? (
              <button
                type="button"
                onClick={() => onSelectCategory(categoryId)}
                aria-pressed={selected}
                className={clsx(
                  'h-full w-full rounded-[16px] border p-3 text-left shadow-[0_1px_2px_rgb(15_23_42/0.025)] transition-[border-color,background-color,transform] duration-200 active:scale-[0.98]',
                  selected
                    ? 'border-brand-300 bg-brand-50/80 ring-2 ring-brand-500/[0.12] dark:border-brand-400/[0.45] dark:bg-brand-400/[0.08]'
                    : 'border-slate-200/[0.85] bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-white/[0.075] dark:bg-[#141821] dark:hover:border-white/[0.12] dark:hover:bg-white/[0.055]',
                )}
              >
                {content}
              </button>
            ) : (
              <div className="h-full rounded-[16px] border border-slate-200/[0.85] bg-white p-3 dark:border-white/[0.075] dark:bg-[#141821]">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
