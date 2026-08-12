/**
 * Sync status badge.
 *
 * Shows the current Google sync status. Local app continues
 * to work regardless of Google state.
 */

import { useSyncStatus } from '@sync/status.queries';
import { Cloud, CloudOff, Loader2, Check, AlertCircle, LogIn } from 'lucide-react';
import clsx from 'clsx';
import { useNavigate } from '@tanstack/react-router';

export function SyncStatusBadge() {
  const status = useSyncStatus();
  const navigate = useNavigate();
  if (!status) return null;

  const config: Record<
    string,
    { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; color: string }
  > = {
    saved: { icon: Check, label: 'Saved', color: 'text-slate-500' },
    offline: { icon: CloudOff, label: 'Offline', color: 'text-slate-500' },
    pending: { icon: Cloud, label: 'Cloud backup pending', color: 'text-amber-600' },
    syncing: { icon: Loader2, label: 'Syncing', color: 'text-blue-600' },
    synced: { icon: Check, label: 'Synced', color: 'text-emerald-600' },
    auth_required: { icon: LogIn, label: 'Sign in to sync', color: 'text-amber-600' },
    error: { icon: AlertCircle, label: 'Sync failed', color: 'text-red-600' },
  };

  const c = config[status.status] ?? config.saved!;
  const Icon = c.icon;
  const isAnimated = status.status === 'syncing';

  return (
    <button
      type="button"
      onClick={() => navigate({ to: '/settings/backup' })}
      className={clsx(
        'flex items-center gap-1 rounded-full px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800',
        c.color,
      )}
      aria-label={`Sync status: ${c.label}`}
    >
      <Icon size={14} className={isAnimated ? 'animate-spin' : ''} />
      <span className="hidden sm:inline">{c.label}</span>
    </button>
  );
}
