import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme, type ThemeMode } from '../useTheme';

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    // Default to light scheme
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to system theme when no preference set', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('system');
    // Resolved theme depends on system, but should be either 'light' or 'dark'
    expect(['light', 'dark']).toContain(result.current.resolvedTheme);
  });

  it('persists theme choice to localStorage', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('dark'));
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('reads existing theme from localStorage', () => {
    localStorage.setItem('theme', 'dark');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('sets data-theme attribute on documentElement', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('dark'));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('reflects system theme on data-theme when set to system', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    // System defaults to light in beforeEach
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('system'));
    // System is light, so data-theme should now be "light"
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('resolves "light" when system prefers light', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false, // prefers-color-scheme: dark = false → light
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    const { result } = renderHook(() => useTheme());
    expect(result.current.resolvedTheme).toBe('light');
  });

  it('resolves "dark" when system prefers dark', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('dark'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    const { result } = renderHook(() => useTheme());
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('cycles through themes: system → light → dark → system', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('system');
    act(() => result.current.cycleTheme());
    expect(result.current.theme).toBe('light');
    act(() => result.current.cycleTheme());
    expect(result.current.theme).toBe('dark');
    act(() => result.current.cycleTheme());
    expect(result.current.theme).toBe('system');
  });

  it('supports all ThemeMode values', () => {
    const { result } = renderHook(() => useTheme());
    const validModes: ThemeMode[] = ['system', 'light', 'dark'];
    for (const mode of validModes) {
      act(() => result.current.setTheme(mode));
      expect(result.current.theme).toBe(mode);
    }
  });
});
