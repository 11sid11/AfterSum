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

  it('idempotently creates settings + self + default categories and leaves onboarding pending', async () => {
    await ensureFirstLaunch();
    const firstCategoryIds = (await getDB().trackCategories.toArray())
      .map((category) => category.id)
      .sort();

    await ensureFirstLaunch();

    const settings = await settingsRepository.get();
    expect(settings.onboardingComplete).toBe(false);
    expect(settings.defaultCurrency).toBe('INR');

    const self = await personRepository.get('self');
    expect(self?.name).toBe('Me');
    expect(self?.isSelf).toBe(true);

    const categories = await getDB().trackCategories.toArray();
    const secondCategoryIds = categories.map((category) => category.id).sort();
    expect(secondCategoryIds).toEqual(firstCategoryIds);

    const expense = categories.filter((category) => category.type === 'expense');
    const income = categories.filter((category) => category.type === 'income');
    expect(expense.length).toBeGreaterThan(0);
    expect(income.length).toBeGreaterThan(0);
  });

  it('does not overwrite a completed onboarding state on later launches', async () => {
    await ensureFirstLaunch();
    await settingsRepository.setOnboardingComplete(true);
    await ensureFirstLaunch();

    const settings = await settingsRepository.get();
    expect(settings.onboardingComplete).toBe(true);
  });
});
