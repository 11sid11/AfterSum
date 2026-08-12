import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB, wipeDB } from '../tests/db-test-utils';
import { getDB } from './database';
import { ensureFirstLaunch } from './seed';
import { settingsRepository } from '@shared/settings/repository';
import { personRepository } from '@shared/people/repository';

describe('first-launch initialization', () => {
  beforeEach(async () => {
    await wipeDB();
    freshDB();
  });

  it('idempotently creates settings + self + default categories', async () => {
    await ensureFirstLaunch();
    await ensureFirstLaunch();
    const settings = await settingsRepository.get();
    expect(settings.onboardingComplete).toBe(true);
    expect(settings.defaultCurrency).toBe('INR');
    const self = await personRepository.get('self');
    expect(self?.name).toBe('Me');
    expect(self?.isSelf).toBe(true);
    const cats = await getDB().trackCategories.toArray();
    expect(cats.length).toBeGreaterThan(0);
    const expense = cats.filter((c) => c.type === 'expense');
    const income = cats.filter((c) => c.type === 'income');
    expect(expense.length).toBeGreaterThan(0);
    expect(income.length).toBeGreaterThan(0);
  });
});
