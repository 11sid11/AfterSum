/**
 * App-level providers.
 *
 * Wraps the entire app with the global providers. Keep this file small —
 * anything heavy should live in its own context module under `src/shared/`.
 */

import { type ReactNode, useEffect, useState } from 'react';
import { ensureFirstLaunch } from '@db/seed';
import { Button, CelebrationProvider, ToastProvider } from '@components/ui';
import { ensureDailyRecoverySnapshot } from '@/backup/recovery';
import { ThemeSync } from '@shared/settings/ThemeSync';
import { PwaUpdatePrompt } from './pwa/PwaUpdatePrompt';

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
      <div className="grid min-h-screen place-items-center p-4">
        <div className="card max-w-md text-center">
          <h1 className="text-lg font-semibold text-rose-600">AfterSum could not open local data</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Reload the app first. If the problem continues, do not clear site data unless you already
            have a portable backup—clearing site data permanently removes local AfterSum records.
          </p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Reload AfterSum
          </Button>
          <details className="mt-4 text-left text-xs text-slate-500">
            <summary className="cursor-pointer font-medium">Technical details</summary>
            <p className="mt-2 break-words">{error}</p>
          </details>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
          Opening AfterSum
        </div>
      </div>
    );
  }

  return (
    <CelebrationProvider>
      <ToastProvider>
        <ThemeSync />
        {children}
        <PwaUpdatePrompt />
      </ToastProvider>
    </CelebrationProvider>
  );
}
