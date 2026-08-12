/**
 * Add Lend entry page.
 *
 * Reads optional `?type=lent|borrowed|repayment_...` and
 * optional `?personId=...` from the search params. The
 * actual form is in `LendEntryForm`.
 */

import { useNavigate, useSearch } from '@tanstack/react-router';
import { LendEntryForm } from '@modules/lend/components/LendEntryForm';
import type { LendEntryType } from '@db/schema';

const ALLOWED_TYPES: ReadonlyArray<LendEntryType> = [
  'lent',
  'borrowed',
  'repayment_received',
  'repayment_given',
  'adjustment',
];

export function LendAddPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { type?: LendEntryType; personId?: string };

  const initialType: LendEntryType = ALLOWED_TYPES.includes(search?.type as LendEntryType)
    ? (search!.type as LendEntryType)
    : 'lent';

  return (
    <LendEntryForm
      defaultType={initialType}
      defaultPersonId={search?.personId}
      onCancel={() => {
        if (search?.personId) {
          navigate({ to: '/lend/person/$personId', params: { personId: search.personId } });
        } else {
          navigate({ to: '/lend' });
        }
      }}
      onSaved={() => {
        if (search?.personId) {
          navigate({ to: '/lend/person/$personId', params: { personId: search.personId } });
        } else {
          navigate({ to: '/lend' });
        }
      }}
    />
  );
}
