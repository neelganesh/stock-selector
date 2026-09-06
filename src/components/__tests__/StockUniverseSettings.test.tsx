import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SettingsPage } from '../SettingsPage';
import { ToastProvider } from '../ToastProvider';
import * as universeService from '../../services/universeService';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock useAuth so SettingsPage sees a logged-in user (needed to enter the
// StockUniverseSettings section — it's gated by isLoggedIn).
vi.mock('../AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'test@example.com' },
    getAccessToken: async () => 'fake-token',
    signOut: async () => {},
  }),
}));

// Mock useTheme so the appearance section is not pulled into render.
vi.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    theme: 'system',
    setTheme: vi.fn(),
    resolvedTheme: 'light',
  }),
}));

// Mock universeService to control counts and refreshUniverse.
const mockGetUniverseCounts = vi.fn();
const mockRefreshUniverse = vi.fn();
vi.mock('../../services/universeService', () => ({
  getUniverseCounts: (...args: unknown[]) => mockGetUniverseCounts(...args),
  refreshUniverse: (...args: unknown[]) => mockRefreshUniverse(...args),
}));

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;
beforeEach(() => {
  // Default: return a valid empty settings response so SettingsPage leaves its
  // loading state. Individual tests can override for their specific scenario.
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => {
    if (typeof url === 'string' && url.includes('/api/settings')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          total_capital: 1000000,
          risk_per_trade_pct: 1,
          max_position_pct: 10,
          max_sector_pct: 25,
          max_open_strategies: 10,
          daily_loss_limit_pct: 3,
          paper_trading_enabled: false,
          paper_trading_capital: 1000000,
        }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
    };
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  mockGetUniverseCounts.mockReset();
  mockRefreshUniverse.mockReset();
  localStorage.clear();
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function renderSettings() {
  return render(
    <ToastProvider>
      <SettingsPage isLoggedIn={true} onLoginClick={() => {}} />
    </ToastProvider>
  );
}

async function switchToUniverseSection() {
  // Wait for settings to finish loading (the skeleton stops showing)
  await waitFor(() => {
    expect(screen.queryByText(/Login to manage/i)).toBeNull();
  });
  // Find by exact text since the button contains both an emoji icon and a label
  const tabs = screen.getAllByRole('button');
  const universeTab = tabs.find((btn) => btn.textContent?.includes('Stock Universe'));
  if (!universeTab) throw new Error('Stock Universe tab not found');
  fireEvent.click(universeTab);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Stock Universe section', () => {
  it('renders the section and shows counts from getUniverseCounts()', async () => {
    mockGetUniverseCounts.mockResolvedValue({
      large: 100,
      mid: 100,
      small: 250,
      total: 450,
    });
    mockRefreshUniverse.mockResolvedValue([]);

    renderSettings();
    await switchToUniverseSection();

    // Wait for the loading skeleton to be replaced by count chips
    await waitFor(() => {
      expect(screen.getByTestId('universe-count-large')).toBeTruthy();
    });
    expect(screen.getByTestId('universe-count-large').textContent).toMatch('100');
    expect(screen.getByTestId('universe-count-mid').textContent).toMatch('100');
    expect(screen.getByTestId('universe-count-small').textContent).toMatch('250');
    expect(screen.getByTestId('universe-count-total').textContent).toMatch('450');
  });

  it('disables the refresh button when no admin token is entered', async () => {
    mockGetUniverseCounts.mockResolvedValue({ large: 0, mid: 0, small: 0, total: 0 });
    mockRefreshUniverse.mockResolvedValue([]);

    renderSettings();
    await switchToUniverseSection();

    await waitFor(() => screen.getByTestId('universe-refresh-button'));
    const btn = screen.getByTestId('universe-refresh-button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('POSTs to /api/admin/refresh-universe with x-admin-token header', async () => {
    mockGetUniverseCounts.mockResolvedValue({ large: 100, mid: 100, small: 250, total: 450 });
    mockRefreshUniverse.mockResolvedValue([]);
    // Override only the admin endpoint response; keep the settings fetch working.
    fetchMock.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/api/admin/refresh-universe')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, large: 100, mid: 100, small: 250, total: 450, durationMs: 1234 }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      };
    });

    renderSettings();
    await switchToUniverseSection();
    await waitFor(() => screen.getByTestId('universe-refresh-button'));

    // Type token and submit
    const input = screen.getByTestId('universe-admin-token') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'my-cron-secret' } });
    expect(input.value).toBe('my-cron-secret');

    await act(async () => {
      fireEvent.click(screen.getByTestId('universe-refresh-button'));
    });

    // Two fetch calls total: /api/settings (initial load) + /api/admin/refresh-universe
    const adminCall = fetchMock.mock.calls.find(
      ([u]) => typeof u === 'string' && u.includes('/api/admin/refresh-universe')
    );
    expect(adminCall).toBeTruthy();
    const [url, init] = adminCall!;
    expect(url).toBe('/api/admin/refresh-universe');
    expect(init.method).toBe('POST');
    expect(init.headers['x-admin-token']).toBe('my-cron-secret');
    expect(init.headers['Content-Type']).toBe('application/json');

    // refreshUniverse should have been called to clear the in-memory cache
    await waitFor(() => {
      expect(mockRefreshUniverse).toHaveBeenCalledTimes(1);
    });

    // The last refresh timestamp is shown
    await waitFor(() => {
      expect(screen.getByTestId('universe-last-refresh')).toBeTruthy();
    });
  });

  it('persists the token to localStorage and loads it back on mount', async () => {
    mockGetUniverseCounts.mockResolvedValue({ large: 0, mid: 0, small: 0, total: 0 });
    mockRefreshUniverse.mockResolvedValue([]);
    localStorage.setItem('stock-selector.adminToken', 'persisted-secret');

    renderSettings();
    await switchToUniverseSection();

    await waitFor(() => screen.getByTestId('universe-admin-token'));
    const input = screen.getByTestId('universe-admin-token') as HTMLInputElement;
    expect(input.value).toBe('persisted-secret');
    // Password-masked by default
    expect(input.type).toBe('password');
  });

  it('shows error toast on 401', async () => {
    mockGetUniverseCounts.mockResolvedValue({ large: 0, mid: 0, small: 0, total: 0 });
    mockRefreshUniverse.mockResolvedValue([]);
    // Override only the admin endpoint to return 401; keep settings OK.
    fetchMock.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/api/admin/refresh-universe')) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: 'Unauthorized' }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      };
    });

    renderSettings();
    await switchToUniverseSection();
    await waitFor(() => screen.getByTestId('universe-refresh-button'));

    fireEvent.change(screen.getByTestId('universe-admin-token'), {
      target: { value: 'bad-token' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('universe-refresh-button'));
    });

    await waitFor(() => {
      expect(screen.getByText(/Token rejected/i)).toBeTruthy();
    });
  });

  it('clears the stored token when the Clear button is clicked', async () => {
    mockGetUniverseCounts.mockResolvedValue({ large: 0, mid: 0, small: 0, total: 0 });
    mockRefreshUniverse.mockResolvedValue([]);
    localStorage.setItem('stock-selector.adminToken', 'some-secret');

    renderSettings();
    await switchToUniverseSection();
    await waitFor(() => screen.getByTestId('universe-admin-token'));

    const input = screen.getByTestId('universe-admin-token') as HTMLInputElement;
    expect(input.value).toBe('some-secret');

    fireEvent.click(screen.getByRole('button', { name: /^Clear$/ }));
    expect(input.value).toBe('');
    expect(localStorage.getItem('stock-selector.adminToken')).toBeNull();
  });
});
