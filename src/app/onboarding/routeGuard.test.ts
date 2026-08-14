import { beforeEach, describe, expect, it } from 'vitest';
import { ensureFirstLaunch } from '@db/seed';
import { settingsRepository } from '@shared/settings/repository';
import { freshDB, wipeDB } from '@/tests/db-test-utils';
import { getOnboardingRedirect } from './routeGuard';

describe('getOnboardingRedirect', () => {
  beforeEach(async () => {
    await wipeDB();
    freshDB();
    await ensureFirstLaunch();
  });

  it('sends an incomplete first run to onboarding', async () => {
    await expect(getOnboardingRedirect('/overview')).resolves.toBe('/onboarding');
    await expect(getOnboardingRedirect('/onboarding')).resolves.toBeNull();
  });

  it('uses the latest persisted completion state on every route check', async () => {
    await expect(getOnboardingRedirect('/overview')).resolves.toBe('/onboarding');

    await settingsRepository.setOnboardingComplete(true);

    await expect(getOnboardingRedirect('/overview')).resolves.toBeNull();
    await expect(getOnboardingRedirect('/onboarding')).resolves.toBe('/overview');
  });
});
