/**
 * SettingsPage regression tests.
 *
 * Bug: SettingsPage "settings" tab never loads. Root cause: `ProfileSettings`
 * sub-component references reveal/copy-key state (`isRevealingKey`,
 * `revealedKey`, `handleRevealKey`, `handleCopyKey`, `handleApiKeyBlur`,
 * `isCopyingKey`, `revealTimeout`) that was never passed in as props, so
 * TypeScript compilation fails and the entire tab is unreachable.
 *
 * These tests guard against regressions of that failure mode.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('../../lib/supabase', () => ({
  supabase: null,
}));

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

vi.mock('./Toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('../GlassCard', () => ({
  GlassCard: ({ children }: { children: any }) => <div>{children}</div>,
}));

vi.mock('./Icon', () => ({
  Icon: ({ name }: { name: string }) => <span data-icon={name} />,
}));

vi.mock('./DeleteAccountModal', () => ({
  DeleteAccountModal: () => null,
}));

vi.mock('../MobileNav', () => ({
  MobileNav: () => null,
}));

vi.mock('../MobileSidebarDrawer', () => ({
  MobileSidebarDrawer: ({ children }: { children: any }) => <>{children}</>,
}));

vi.mock('../context/StrategyContext', () => ({
  StrategyProvider: ({ children }: { children: any }) => children,
  useStrategy: () => ({
    activeStrategy: { id: 's1', name: 'S', description: '', rules: [] },
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

vi.mock('../CapitalBar', () => ({
  CapitalBar: () => null,
}));

vi.mock('../ExecuteModal', () => ({
  ExecuteModal: () => null,
}));

vi.mock('../ExpandableCard', () => ({
  ExpandableCard: () => null,
}));

vi.mock('../AnimatedNumber', () => ({
  AnimatedNumber: ({ value }: { value: number }) => <span>{value}</span>,
}));

vi.mock('../Pagination', () => ({
  Pagination: () => null,
}));

vi.mock('../useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('../InfoTooltip', () => ({
  InfoTooltip: ({ children }: { children: any }) => <>{children}</>,
}));

vi.mock('../ToastProvider', () => ({
  ToastProvider: ({ children }: { children: any }) => <>{children}</>,
}));

vi.mock('../MobileViewTabs', () => ({
  MobileViewTabs: () => null,
}));

vi.mock('../MobileBodyClass', () => ({
  MobileBodyClass: () => null,
}));

vi.mock('../ZerodhaStatusButton', () => ({
  ZerodhaStatusButton: () => null,
}));

vi.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    theme: 'system',
    resolvedTheme: 'light',
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
  }),
}));

vi.mock('../../services/kitePublisher', () => ({
  placeOrder: vi.fn().mockResolvedValue({ orderPlaced: true }),
}));

vi.mock('../../lib/authFetch', () => ({
  authFetch: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
}));

vi.mock('../../engine/types', () => ({
  StockPick: {},
}));

vi.mock('../../components/Sidebar', () => ({
  Sidebar: () => null,
}));

import { SettingsPage } from '../SettingsPage';

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url === '/api/kite') {
        return Promise.resolve({ ok: true, json: async () => ({ configured: false, working: false }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          paper_trading_enabled: false,
          paper_trading_capital: 100000,
          full_name: 'Tester',
        }),
      });
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('mounts when logged in (previously crashed on TS compile)', async () => {
    render(
      <SettingsPage
        isLoggedIn
        onLoginClick={vi.fn()}
      />,
    );
    // Wait for loading to complete (fetchSettings uses setTimeout 100ms)
    await vi.waitFor(() => expect(screen.getByText('Personal Information')).toBeInTheDocument());
    expect(screen.queryByText('Zerodha Publisher API Key')).not.toBeInTheDocument();
  });

  it('shows login prompt when not logged in', () => {
    render(<SettingsPage isLoggedIn={false} onLoginClick={vi.fn()} />);
    expect(screen.getByText(/login to manage your account settings/i)).toBeInTheDocument();
  });
});
