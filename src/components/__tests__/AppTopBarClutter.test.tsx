/**
 * Public-app top bar regression test.
 *
 * Contract after the public-app refactor:
 *   - No "Sign in" UI, no Kite / Zerodha buttons, no Settings tab.
 *   - Top bar shows an "Upstox" data-source pill with last-updated time
 *     and a "Refetch" button that triggers `refetch()`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('../../lib/supabase', () => ({
  supabase: null,
}));

const mockRefetch = vi.fn().mockResolvedValue(undefined);

vi.mock('../../context/StrategyContext', () => ({
  StrategyProvider: ({ children }: { children: any }) => children,
  useStrategy: () => ({
    strategies: [
      { id: 'zerodha-swing', name: 'Swing Strategy', description: '', rules: [] },
    ],
    activeStrategy: { id: 'zerodha-swing', name: 'Swing Strategy', description: '', rules: [] },
    activeStrategyId: 'zerodha-swing',
    setActiveStrategyId: vi.fn(),
    capCategory: 'all',
    setCapCategory: vi.fn(),
    picks: [],
    isScanning: false,
    lastUpdated: '2026-01-01T10:00:00.000Z',
    refetch: mockRefetch,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    signalFilter: 'all',
    setSignalFilter: vi.fn(),
    sortBy: 'rank',
    setSortBy: vi.fn(),
    resultCapFilter: 'all',
    setResultCapFilter: vi.fn(),
  }),
}));

globalThis.fetch = vi.fn().mockResolvedValue({
  ok: false,
  status: 404,
  json: async () => ({}),
} as any);

import App from '../../App';

describe('App.tsx public top bar', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the Refetch button and the Upstox pill', async () => {
    render(<App />);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.getByRole('button', { name: /refetch/i })).toBeTruthy();
    expect(screen.getByText(/upstox/i)).toBeTruthy();
  });

  it('calls refetch() when the Refetch button is clicked', async () => {
    render(<App />);
    await new Promise((resolve) => setTimeout(resolve, 100));
    fireEvent.click(screen.getByRole('button', { name: /refetch/i }));
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('has no Sign in button and no Kite / Settings UI', async () => {
    render(<App />);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.queryByRole('button', { name: /sign in/i })).toBeNull();
    expect(screen.queryByText(/zerodha/i)).toBeNull();
    expect(screen.queryByText(/kite/i)).toBeNull();
    expect(screen.queryByText(/settings/i)).toBeNull();
  });
});
