/**
 * Tests for ZerodhaStatusButton — polls GET /api/kite/key-status to show Kite config state.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

vi.mock('../../lib/supabase', () => ({ supabase: null }));

vi.mock('../AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'test@example.com' },
    getAccessToken: vi.fn().mockResolvedValue('fake-token'),
  }),
}));

// ---------------------------------------------------------------------------
// Supabase mock must intercept the dynamic import inside checkStatus()
// ---------------------------------------------------------------------------
const mockSupabaseGetSession = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockSupabaseGetSession(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// fetch mock (used to call /api/kite/key-status)
// ---------------------------------------------------------------------------
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  mockSupabaseGetSession.mockReset();
  mockSupabaseGetSession.mockResolvedValue({ data: { session: { access_token: 'fake-token' } } });
  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
});
afterEach(() => {
  cleanup();
});

import { ZerodhaStatusButton } from '../ZerodhaStatusButton';

describe('ZerodhaStatusButton', () => {
  it('renders loading state initially', async () => {
    // Delay the response so loading state is observable
    fetchMock.mockImplementation(() => new Promise(() => {}));
    render(<ZerodhaStatusButton />);
    // The button is always visible; the dot color indicates the state
    expect(screen.getByRole('button', { name: /kite/i })).toBeTruthy();
  });

  it('renders not-configured state when API returns configured:false', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ configured: false }),
    });

    render(<ZerodhaStatusButton onNavigateToProfile={vi.fn()} />);
    await waitFor(() => {
      // Grey dot for not-configured
      expect(screen.getByTitle('Configure Kite API key')).toBeTruthy();
    });
  });

  it('renders configured state with green dot when key is saved', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ configured: true, working: true }),
    });

    render(<ZerodhaStatusButton onNavigateToProfile={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTitle('Kite API key configured')).toBeTruthy();
    });
  });

  it('renders error state when key is configured but decrypt fails', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ configured: true, working: false }),
    });

    render(<ZerodhaStatusButton onNavigateToProfile={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTitle('Kite API key error — check profile settings')).toBeTruthy();
    });
  });

  it('renders not-configured when fetch returns non-ok', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
    });

    render(<ZerodhaStatusButton />);
    await waitFor(() => {
      expect(screen.getByTitle('Configure Kite API key')).toBeTruthy();
    });
  });

  it('renders not-configured when no auth token', async () => {
    mockSupabaseGetSession.mockResolvedValue({ data: { session: null } });

    render(<ZerodhaStatusButton />);
    await waitFor(() => {
      expect(screen.getByTitle('Configure Kite API key')).toBeTruthy();
    });
  });

  it('calls onNavigateToProfile when clicked', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ configured: false }),
    });

    const onNavigate = vi.fn();
    render(<ZerodhaStatusButton onNavigateToProfile={onNavigate} />);
    await waitFor(() => screen.getByRole('button', { name: /kite/i }));
    screen.getByRole('button', { name: /kite/i }).click();
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('does not throw when onNavigateToProfile is omitted', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ configured: false }),
    });

    render(<ZerodhaStatusButton />);
    await waitFor(() => screen.getByRole('button', { name: /kite/i }));
    expect(() => screen.getByRole('button', { name: /kite/i }).click()).not.toThrow();
  });
});
