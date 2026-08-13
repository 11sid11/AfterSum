import { describe, expect, it } from 'vitest';
import { myPaid, myShare } from './aggregations';
import type {
  SplitExpense,
  SplitGroup,
  SplitGroupMember,
  SplitPayer,
  SplitShare,
} from '@db/schema';

const NOW = '2026-08-13T00:00:00.000Z';

const group: SplitGroup = {
  id: 'g1',
  name: 'Goa',
  currency: 'INR',
  archived: false,
  createdAt: NOW,
  updatedAt: NOW,
  revision: 1,
};

const member: SplitGroupMember = {
  id: 'm-self',
  groupId: group.id,
  personId: 'self',
  active: true,
  joinedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
  revision: 1,
};

function expense(id: string, deleted = false): SplitExpense {
  return {
    id,
    groupId: group.id,
    title: id,
    amountMinor: 3000,
    currency: 'INR',
    date: '2026-08-13',
    splitMethod: 'equal',
    createdAt: NOW,
    updatedAt: NOW,
    revision: 1,
    ...(deleted ? { deletedAt: NOW } : {}),
  };
}

function payer(expenseId: string, amountMinor: number): SplitPayer {
  return {
    id: `payer-${expenseId}`,
    expenseId,
    personId: 'self',
    amountMinor,
    createdAt: NOW,
    updatedAt: NOW,
    revision: 1,
  };
}

function share(expenseId: string, amountMinor: number): SplitShare {
  return {
    id: `share-${expenseId}`,
    expenseId,
    personId: 'self',
    amountMinor,
    createdAt: NOW,
    updatedAt: NOW,
    revision: 1,
  };
}

describe('split aggregate personal amounts', () => {
  it('ignores payer and share rows whose expense was deleted', () => {
    const active = expense('active');
    const deleted = expense('deleted', true);
    const input = {
      group,
      members: [member],
      expenses: [active, deleted],
      payers: [payer(active.id, 3000), payer(deleted.id, 5000)],
      shares: [share(active.id, 1000), share(deleted.id, 2000)],
      settlements: [],
      selfPersonId: 'self',
    };

    expect(myPaid(input)).toBe(3000);
    expect(myShare(input)).toBe(1000);
  });
});
