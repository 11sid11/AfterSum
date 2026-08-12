/**
 * App-level providers.
 *
 * Wraps the entire app with the global providers. Keep
 * this file small — anything heavy should live in its own
 * context module under `src/shared/`.
 */

import { type ReactNode } from 'react';
import { ensureFirstLaunch } from '@db/seed';
import { useEffect, useState } from 'react';
import { ToastProvider } from '@components/ui';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureFirstLaunch()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });
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
