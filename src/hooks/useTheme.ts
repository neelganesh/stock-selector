import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'theme';
const DATA_ATTR = 'data-theme';

function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // localStorage may throw in private mode / disabled
  }
  return 'system';
}

function writeStoredTheme(theme: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute(DATA_ATTR, resolved);
  document.documentElement.style.colorScheme = resolved;
}

const THEME_CYCLE: ThemeMode[] = ['system', 'light', 'dark'];

export interface UseThemeResult {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
  cycleTheme: () => void;
}

/**
 * Theme management with three modes: system (follows OS), light, dark.
 * - Persists preference in localStorage
 * - Applies [data-theme] attribute on <html> for CSS variable switching
 * - Updates color-scheme to control native form controls / scrollbars
 * - Reacts to system theme changes when in 'system' mode
 * - Syncs across tabs via storage events
 */
export function useTheme(): UseThemeResult {
  const [theme, setThemeState] = useState<ThemeMode>(() => readStoredTheme());
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());

  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme;

  // Apply theme to document when resolvedTheme changes
  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  // Listen to system theme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemTheme(mq.matches ? 'dark' : 'light');
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if ((mq as any).addListener) (mq as any).addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else if ((mq as any).removeListener) (mq as any).removeListener(onChange);
    };
  }, []);

  // Cross-tab sync
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const next = e.newValue;
        if (next === 'light' || next === 'dark' || next === 'system') {
          setThemeState(next);
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    writeStoredTheme(next);
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeState((current) => {
      const idx = THEME_CYCLE.indexOf(current);
      const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
      writeStoredTheme(next);
      return next;
    });
  }, []);

  return { theme, resolvedTheme, setTheme, cycleTheme };
}
