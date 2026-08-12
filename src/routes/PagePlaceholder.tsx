/**
 * Placeholder for route pages that haven't been implemented yet.
 * Subagents will replace these with real implementations.
 */

import { type ReactNode } from 'react';
import { Card } from '@components/ui';

export function PagePlaceholder({ title, hint }: { title: string; hint?: ReactNode }) {
  return (
    <Card>
      <h1 className="text-lg font-semibold">{title}</h1>
      {hint && <p className="mt-2 text-sm text-slate-500">{hint}</p>}
      <p className="mt-4 text-xs text-amber-600">This page is a placeholder. Implementation pending.</p>
    </Card>
  );
}
