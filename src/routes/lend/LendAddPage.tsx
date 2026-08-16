/** Add Lend entry page. */

import { useNavigate, useSearch } from '@tanstack/react-router';
import { LendEntryForm } from '@modules/lend/components/LendEntryForm';
import type { LendEntryType } from '@db/schema';
import type { LendQuickDirection } from '@modules/lend/domain/quickEntry';

function directionFromLegacyType(type: LendEntryType | undefined): LendQuickDirection | undefined {
  switch (type) {
    case 'lent':
    case 'repayment_given':
      return 'gave';
    case 'borrowed':
    case 'repayment_received':
      return 'got';
    default:
      return undefined;
  }
}

export function LendAddPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as {
    direction?: LendQuickDirection;
    type?: LendEntryType;
    personId?: string;
  };

  const defaultDirection: LendQuickDirection =
    search.direction === 'gave' || search.direction === 'got'
      ? search.direction
      : directionFromLegacyType(search.type) ?? 'gave';

  return (
    <LendEntryForm
      defaultDirection={defaultDirection}
      defaultPersonId={search.personId}
      onCancel={() => {
        if (search.personId) {
          navigate({ to: '/lend/person/$personId', params: { personId: search.personId } });
        } else {
          navigate({ to: '/lend' });
        }
      }}
      onSaved={() => {
        if (search.personId) {
          navigate({ to: '/lend/person/$personId', params: { personId: search.personId } });
        } else {
          navigate({ to: '/lend' });
        }
      }}
    />
  );
}
