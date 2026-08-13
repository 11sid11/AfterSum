import { useEffect } from 'react';
import type { AppTheme } from '@db/schema';
import { useAppSettings } from './useSettings';

export function resolveDarkMode(theme: AppTheme, systemPrefersDark: boolean): boolean {
  return theme === 'dark' || (theme === 'system' && systemPrefersDark);
}

/**
 * Keeps Tailwind's class-based dark mode in sync with the persisted app setting.
 * System mode also follows OS/browser theme changes while the app is open.
 */
export function ThemeSync() {
  const settings = useAppSettings();

  useEffect(() => {
    if (!settings || typeof document === 'undefined') return;

    const media =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;

    const apply = () => {
      const dark = resolveDarkMode(settings.theme, media?.matches ?? false);
      const root = document.documentElement;
      root.classList.toggle('dark', dark);
      root.style.colorScheme = dark ? 'dark' : 'light';
    };

    apply();

    if (settings.theme !== 'system' || !media) return;

    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings?.theme]);

  return null;
}
