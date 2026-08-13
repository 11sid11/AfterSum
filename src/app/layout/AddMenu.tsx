/** Universal Add menu shown from Overview only. */

import { useNavigate } from '@tanstack/react-router';
import { Receipt, X, TrendingUp, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

interface AddMenuProps {
  onClose: () => void;
}

export function AddMenu({ onClose }: AddMenuProps) {
  const navigate = useNavigate();
  const items = [
    { label: 'Personal expense', hint: 'Track', to: '/track/add', search: { type: 'expense' as const }, icon: Receipt },
    { label: 'Income', hint: 'Track', to: '/track/add', search: { type: 'income' as const }, icon: TrendingUp },
    { label: 'Lent money', hint: 'Lend', to: '/lend/add', search: { type: 'lent' as const }, icon: ArrowUpFromLine },
    { label: 'Borrowed money', hint: 'Lend', to: '/lend/add', search: { type: 'borrowed' as const }, icon: ArrowDownToLine },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md animate-slide-up rounded-t-[28px] border border-white/40 bg-white p-5 shadow-2xl dark:border-slate-700/60 dark:bg-slate-900 sm:rounded-[28px] sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold tracking-tight">Quick add</h2><p className="mt-0.5 text-xs text-slate-500">Choose what you want to record.</p></div>
          <button type="button" onClick={onClose} aria-label="Close" className="icon-button"><X size={18} /></button>
        </div>
        <ul className="grid grid-cols-2 gap-2.5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.label}>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate({ to: item.to, search: item.search } as never);
                  }}
                  className="flex min-h-24 w-full flex-col items-start justify-between rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300"><Icon size={17} /></span>
                  <span><span className="block text-sm font-semibold">{item.label}</span><span className="mt-0.5 block text-[11px] text-slate-400">{item.hint}</span></span>
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => {
            onClose();
            navigate({ to: '/split' });
          }}
          className="mt-3 w-full rounded-2xl bg-slate-50 px-3.5 py-3 text-left text-xs leading-5 text-slate-500 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800"
        >
          Splitting an expense? Open <strong className="font-semibold text-slate-700 dark:text-slate-200">Split</strong> and choose the trip first.
        </button>
      </div>
    </div>
  );
}
