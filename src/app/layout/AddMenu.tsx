/** Universal Add menu shown from Overview only. */

import { useNavigate } from '@tanstack/react-router';
import { Receipt, X, TrendingUp, ArrowDownToLine, ArrowUpFromLine, Users } from 'lucide-react';

interface AddMenuProps {
  onClose: () => void;
}

export function AddMenu({ onClose }: AddMenuProps) {
  const navigate = useNavigate();
  const items = [
    { label: 'Personal expense', hint: 'Track', to: '/track/add', search: { type: 'expense' as const }, icon: Receipt, tone: 'bg-rose-500/[0.09] text-rose-600 dark:text-rose-300' },
    { label: 'Income', hint: 'Track', to: '/track/add', search: { type: 'income' as const }, icon: TrendingUp, tone: 'bg-emerald-500/[0.09] text-emerald-600 dark:text-emerald-300' },
    { label: 'You gave money', hint: 'Lend', to: '/lend/add', search: { direction: 'gave' as const }, icon: ArrowUpFromLine, tone: 'bg-rose-500/[0.09] text-rose-600 dark:text-rose-300' },
    { label: 'You got money', hint: 'Lend', to: '/lend/add', search: { direction: 'got' as const }, icon: ArrowDownToLine, tone: 'bg-emerald-500/[0.09] text-emerald-600 dark:text-emerald-300' },
  ];

  return (
    <div
      className="modal-backdrop fixed inset-0 z-40 flex items-end justify-center bg-slate-950/[0.45] backdrop-blur-[5px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-panel w-full max-w-md rounded-t-[30px] border border-slate-900/[0.07] bg-[#fbfbfc] p-5 shadow-soft-lg dark:border-white/[0.08] dark:bg-[#111217] sm:rounded-[30px] sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">New record</p>
            <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.035em]">Quick add</h2>
          </div>
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
                  className="surface-lift flex min-h-28 w-full flex-col items-start justify-between rounded-[22px] border border-slate-900/[0.06] bg-white/90 p-3.5 text-left shadow-soft-xs dark:border-white/[0.07] dark:bg-white/[0.04] dark:shadow-none"
                >
                  <span className={`grid h-10 w-10 place-items-center rounded-[15px] ${item.tone}`}><Icon size={18} /></span>
                  <span>
                    <span className="block text-sm font-semibold tracking-[-0.015em]">{item.label}</span>
                    <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{item.hint}</span>
                  </span>
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
          className="interactive-row mt-3 flex w-full items-center gap-3 rounded-[20px] border border-slate-900/[0.055] bg-slate-900/[0.025] px-3.5 py-3 text-left dark:border-white/[0.07] dark:bg-white/[0.035]"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[13px] bg-brand-500/[0.09] text-brand-600 dark:text-brand-300"><Users size={16} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold tracking-[-0.01em]">Split an expense</span>
            <span className="mt-0.5 block text-xs text-slate-500">Choose the trip first.</span>
          </span>
        </button>
      </div>
    </div>
  );
}
