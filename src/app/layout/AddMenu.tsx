/**
 * Universal Add menu.
 *
 * Routes into the correct module form. V1 only routes into
 * Track, Split, Lend. Categories / members are added inside
 * the relevant forms.
 */

import { useNavigate } from '@tanstack/react-router';
import { Receipt, Users, X, TrendingUp, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

interface AddMenuProps {
  onClose: () => void;
}

export function AddMenu({ onClose }: AddMenuProps) {
  const navigate = useNavigate();

  const items = [
    {
      label: 'Personal expense',
      to: '/track/add',
      search: { type: 'expense' as const },
      icon: Receipt,
    },
    {
      label: 'Income',
      to: '/track/add',
      search: { type: 'income' as const },
      icon: TrendingUp,
    },
    {
      label: 'Split expense',
      to: '/split/group/new/add',
      search: { type: 'expense' as const },
      icon: Users,
    },
    {
      label: 'Lent money',
      to: '/lend/add',
      search: { type: 'lent' as const },
      icon: ArrowUpFromLine,
    },
    {
      label: 'Borrowed money',
      to: '/lend/add',
      search: { type: 'borrowed' as const },
      icon: ArrowDownToLine,
    },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" role="dialog">
      <div className="w-full max-w-md animate-slide-up rounded-t-2xl bg-white p-4 dark:bg-slate-900 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Add</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>
        <ul className="space-y-1">
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
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Icon size={20} className="text-brand-600" />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
