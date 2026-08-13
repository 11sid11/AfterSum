/**
 * App-level providers.
 *
 * Wraps the entire app with the global providers. Keep this file small —
 * anything heavy should live in its own context module under `src/shared/`.
 */

import { type ReactNode, useEffect, useState } from 'react';
import { ensureFirstLaunch } from '@db/seed';
import { ToastProvider } from '@components/ui';
import { ensureDailyRecoverySnapshot } from '@/backup/recovery';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      try {
        await ensureFirstLaunch();

        // Recovery is best-effort. A quota/storage failure must never prevent
        // the offline app itself from opening.
        try {
          await ensureDailyRecoverySnapshot();
        } catch (recoveryError) {
          console.warn('Could not create local recovery checkpoint.', recoveryError);
        }

        if (!cancelled) setReady(true);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    };

    void initialize();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center p-4 text-center">
        <div>
          <h1 className="text-lg font-semibold text-red-600">Database error</h1>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
          <p className="mt-1 text-xs text-slate-400">
            Try clearing site data in your browser settings.
          </p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center text-slate-400">
        <p>Loading…</p>
      </div>
    );
  }

  return <ToastProvider>{children}</ToastProvider>;
}
