import { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * User-controlled PWA update prompt.
 *
 * The new service worker is activated only when the user chooses Update now,
 * which avoids reloading the app while somebody is in the middle of an edit.
 * IndexedDB data is independent from the service-worker/app-shell update.
 */
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(false);

  if (!needRefresh) return null;

  const update = async () => {
    if (updating) return;
    setUpdating(true);
    setError(false);

    try {
      await updateServiceWorker(true);
    } catch {
      setUpdating(false);
      setError(true);
    }
  };

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 top-3 z-[80] mx-auto max-w-md rounded-[18px] border border-brand-200/80 bg-white/[0.98] p-3.5 shadow-[0_16px_40px_rgb(15_23_42/0.16)] backdrop-blur-xl dark:border-brand-400/[0.2] dark:bg-[#171b24]/[0.98]"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-400/[0.12] dark:text-brand-200">
          <RefreshCw size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-950 dark:text-white">AfterSum update ready</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Update the app shell without reinstalling. Your saved local data stays on this device.
          </p>
          {error && (
            <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-300">
              Could not apply the update. Please try again.
            </p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void update()}
              disabled={updating}
              className="btn btn-primary min-h-9 px-3 text-xs"
            >
              {updating ? 'Updating…' : 'Update now'}
            </button>
            <button
              type="button"
              onClick={() => setNeedRefresh(false)}
              disabled={updating}
              className="btn btn-ghost min-h-9 px-3 text-xs"
            >
              Later
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          disabled={updating}
          aria-label="Dismiss update"
          className="icon-button h-9 w-9 shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </aside>
  );
}
