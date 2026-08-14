import { settingsRepository } from '@shared/settings/repository';

export type OnboardingRedirect = '/onboarding' | '/overview' | null;

function isOnboardingPath(pathname: string): boolean {
  return pathname === '/onboarding' || pathname.startsWith('/onboarding/');
}

/**
 * Resolve the onboarding redirect from the latest persisted settings.
 *
 * The guard intentionally reads IndexedDB on each route check instead of
 * trusting a render-time live-query snapshot. That prevents a completed
 * onboarding flow from being redirected back to the wizard while Dexie's
 * subscription is still catching up with the final settings write.
 */
export async function getOnboardingRedirect(pathname: string): Promise<OnboardingRedirect> {
  const settings = await settingsRepository.get();
  const onboardingPath = isOnboardingPath(pathname);

  if (!settings.onboardingComplete && !onboardingPath) return '/onboarding';
  if (settings.onboardingComplete && onboardingPath) return '/overview';
  return null;
}
