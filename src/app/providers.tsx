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
import { ThemeSync } from '@shared/settings/ThemeSync';

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
        if (cancelled) return;

        setReady(true);

        // Recovery is best-effort and deliberately off the startup critical
        // path so a large local history never delays opening the PWA.
        void ensureDailyRecoverySnapshot().catch((recoveryError) => {
          console.warn('Could not create local recovery checkpoint.', recoveryError);
        });
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

  return (
    <ToastProvider>
      <ThemeSync />
      {children}
    </ToastProvider>
  );
}
