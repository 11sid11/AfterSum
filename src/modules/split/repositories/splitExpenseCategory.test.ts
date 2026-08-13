import { beforeEach, describe, expect, it } from 'vitest';
import { freshDB, wipeDB } from '@tests/db-test-utils';
import { settingsRepository } from '@shared/settings/repository';
import { splitGroupRepository } from './splitGroupRepository';
import { splitExpenseRepository } from './splitExpenseRepository';

beforeEach(async () => {
  await wipeDB();
  freshDB();
  await settingsRepository.get();
});

describe('splitExpenseRepository category persistence', () => {
  it('stores the category during atomic expense creation', async () => {
    const group = await splitGroupRepository.create({ name: 'Trip', currency: 'INR' });
    const { expense } = await splitExpenseRepository.createAtomic({
      groupId: group.id,
      title: 'Dinner',
      amountMinor: 1200,
      currency: 'INR',
      date: '2026-08-13',
      splitMethod: 'equal',
      category: 'food',
      payers: [{ personId: 'self', amountMinor: 1200 }],
      participantIds: ['self', 'friend'],
      allocation: { method: 'equal' },
    });

    expect(expense.category).toBe('food');
    expect((await splitExpenseRepository.get(expense.id))?.category).toBe('food');
  });
});
