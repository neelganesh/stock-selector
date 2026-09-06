/**
 * App-level wiring regression test.
 *
 * Bug: App.tsx wired CapitalBar's `isLoggedIn` prop to
 * `activeDataSource.includes('Kite')` (the broker data-source status)
 * instead of the user's auth state. After signing in, a user without
 * Kite credentials still saw "Capital unavailable — sign in to view".
 *
 * This test mounts the App with a logged-in user and a yfinance data
 * source and asserts the "sign in" placeholder is NOT rendered.
 *
 * The fix is to pass `isLoggedIn={!!user}` (the auth state).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Mock Supabase so the auth provider has something to talk to.
vi.mock('../../lib/supabase', () => ({
  supabase: null,
}));

// Mock AuthProvider to return a signed-in user.
vi.mock('../AuthProvider', () => ({
  AuthProvider: ({ children }: { children: any }) => children,
  useAuth: () => ({
    user: { id: 'u1', email: 'a@b.com' },
    profile: { full_name: 'Tester', paper_trading_enabled: false },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    refreshProfile: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue('fake-token'),
  }),
}));

// Mock StrategyContext to return a yfinance data source (NOT Kite).
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
    activeDataSource: 'yfinance (Fallback)',
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

// Mock ZerodhaStatusButton to prevent network calls to /api/kite/key-status
vi.mock('../ZerodhaStatusButton', () => ({
  ZerodhaStatusButton: vi.fn(() => null),
}));

// Mock capital fetch so we don't try to hit network in jsdom.
globalThis.fetch = vi.fn().mockResolvedValue({
  ok: false,
  status: 404,
  json: async () => ({}),
} as any);

import App from '../../App';

describe('App.tsx CapitalBar wiring', () => {
  beforeEach(() => {
    // Suppress noisy console output from intentional network failures.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  it('does NOT show "sign in to view" when user is logged in (no Kite)', async () => {
    render(<App />);
    // Give effects a tick to settle
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText(/sign in to view/i)).toBeNull();
  });
});
