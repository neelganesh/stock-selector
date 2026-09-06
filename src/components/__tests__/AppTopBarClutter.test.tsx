/**
 * Top bar de-clutter regression test.
 *
 * Bug: The dashboard top bar had two adjacent buttons that opened the
 * same Zerodha login modal:
 *   - "Data Source: yfinance (Fallback)" / "Kite API (Live)" pill
 *   - A standalone "Connect Zerodha" pill
 * The standalone "Connect Zerodha" button is redundant once Kite is
 * connected (data-source pill already opens the modal). Showing both
 * clutters the top bar with two pills doing the same job.
 *
 * Contract: when activeDataSource is 'Zerodha Kite API (Live)', the
 * standalone "Connect Zerodha" button MUST be hidden (the data-source
 * pill already shows the connection state and opens the modal on click).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('../../lib/supabase', () => ({
  supabase: null,
}));

vi.mock('../AuthProvider', () => ({
  AuthProvider: ({ children }: { children: any }) => children,
  useAuth: () => ({
    user: null,
    profile: null,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    refreshProfile: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue(null),
  }),
}));

const { mockStrategyState } = vi.hoisted(() => ({
  mockStrategyState: {
    activeDataSource: 'yfinance (Fallback)' as 'Zerodha Kite API (Live)' | 'yfinance (Fallback)',
  },
}));

vi.mock('../../context/StrategyContext', () => ({
  StrategyProvider: ({ children }: { children: any }) => children,
  useStrategy: () => ({
    activeStrategy: { id: 's1', name: 'Zerodha Swing Strategy', description: '', rules: [] },
    capCategory: 'all',
    picks: [],
    isScanning: false,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    signalFilter: 'all',
    setSignalFilter: vi.fn(),
    sortBy: 'rank',
    setSortBy: vi.fn(),
    resultCapFilter: 'all',
    setResultCapFilter: vi.fn(),
    activeDataSource: mockStrategyState.activeDataSource,
    setActiveDataSource: vi.fn(),
    isZerodhaModalOpen: false,
    setIsZerodhaModalOpen: vi.fn(),
    runScan: vi.fn(),
    strategies: [],
    activeStrategyId: 's1',
    setActiveStrategyId: vi.fn(),
    setCapCategory: vi.fn(),
    progress: { scanned: 0, total: 0, currentSymbol: '', status: 'idle', percent: 0 },
    customScripList: [],
    setCustomScripList: vi.fn(),
  }),
}));

globalThis.fetch = vi.fn().mockResolvedValue({
  ok: false,
  status: 404,
  json: async () => ({}),
} as any);

import App from '../../App';

describe('App.tsx top bar de-clutter', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    mockStrategyState.activeDataSource = 'yfinance (Fallback)';
  });

  it('hides "Connect Zerodha" pill when Kite is live (data-source pill is sufficient)', async () => {
    mockStrategyState.activeDataSource = 'Zerodha Kite API (Live)';
    render(<App />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('button', { name: /connect zerodha/i })).toBeNull();
  });

  it('shows "Sign in" button when not connected to Kite (yfinance fallback)', async () => {
    mockStrategyState.activeDataSource = 'yfinance (Fallback)';
    render(<App />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByRole('button', { name: /sign in/i })).toBeTruthy();
  });
});
