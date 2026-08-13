import { describe, expect, it } from 'vitest';
import { resolveDarkMode } from './ThemeSync';

describe('resolveDarkMode', () => {
  it('forces dark mode when dark is selected', () => {
    expect(resolveDarkMode('dark', false)).toBe(true);
  });

  it('forces light mode when light is selected', () => {
    expect(resolveDarkMode('light', true)).toBe(false);
  });

  it('follows the system preference in system mode', () => {
    expect(resolveDarkMode('system', true)).toBe(true);
    expect(resolveDarkMode('system', false)).toBe(false);
  });
});
