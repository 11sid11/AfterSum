/**
 * Recurring is intentionally not exposed until the template-to-
 * transaction flow is complete and uses the shared MoneyInput.
 * Keeping this route provides a safe destination for old links.
 */

import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, CalendarClock } from 'lucide-react';
import { Button, Card } from '@components/ui';

export function TrackRecurringPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate({ to: '/track' })}
          aria-label="Back"
          className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-semibold">Recurring expenses</h1>
      </header>

      <Card>
        <div className="flex items-start gap-3">
          <CalendarClock size={22} className="mt-0.5 text-brand-600" />
          <div>
            <p className="text-sm font-semibold">Not available in this build</p>
            <p className="mt-1 text-sm text-slate-500">
              Recurring templates are hidden until “log now” can open a correctly prefilled transaction. Existing financial records are unaffected.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={() => navigate({ to: '/track' })}>Back to Track</Button>
        </div>
      </Card>
    </div>
  );
}
