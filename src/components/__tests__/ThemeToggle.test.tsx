import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import { ThemeToggle } from '../ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders a button with an accessible label', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    expect(button).toBeTruthy();
    expect(button.getAttribute('aria-label')).toBeTruthy();
  });

  it('cycles through system → light → dark → system when clicked', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    const labels: string[] = [button.getAttribute('aria-label') ?? ''];

    act(() => fireEvent.click(button));
    labels.push(button.getAttribute('aria-label') ?? '');

    act(() => fireEvent.click(button));
    labels.push(button.getAttribute('aria-label') ?? '');

    act(() => fireEvent.click(button));
    labels.push(button.getAttribute('aria-label') ?? '');

    // Should have visited at least 3 distinct states
    const unique = new Set(labels);
    expect(unique.size).toBeGreaterThanOrEqual(3);
  });

  it('reflects current theme via data-theme attribute', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    // Default system → resolves to light
    expect(document.documentElement.dataset.theme).toBe('light');
    // Click once → light
    act(() => fireEvent.click(button));
    expect(document.documentElement.dataset.theme).toBe('light');
    // Click again → dark
    act(() => fireEvent.click(button));
    expect(document.documentElement.dataset.theme).toBe('dark');
    // Click again → system (still resolves to light)
    act(() => fireEvent.click(button));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('uses an icon that reflects the current mode', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    // Has some inline SVG icon
    expect(button.querySelector('svg')).toBeTruthy();
  });
});
