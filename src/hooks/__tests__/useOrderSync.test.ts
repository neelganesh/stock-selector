import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOrderSync } from '../useOrderSync';

// Mock fetch globally
const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

describe('useOrderSync', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns idle state when disabled (no user, no paper trading)', () => {
    const { result } = renderHook(() =>
      useOrderSync({ isLoggedIn: false, paperTradingEnabled: false })
    );

    expect(result.current.isPolling).toBe(false);
    expect(result.current.executions).toEqual([]);
    expect(result.current.orders).toEqual([]);
    expect(result.current.gtts).toEqual([]);
    expect(result.current.lastSyncedAt).toBeNull();
  });

  it('fetches executions immediately when enabled with logged-in user', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [{ id: 'exec-1', symbol: 'RELIANCE', status: 'entry_filled' }],
    });

    const { result } = renderHook(() =>
      useOrderSync({ isLoggedIn: true, paperTradingEnabled: false })
    );

    await waitFor(() => {
      expect(result.current.executions).toHaveLength(1);
    });

    expect(result.current.executions[0].symbol).toBe('RELIANCE');
    expect(result.current.lastSyncedAt).toBeInstanceOf(Date);
  });

  it('fetches paper positions when paperTradingEnabled is true', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [{ id: 'paper-1', symbol: 'TCS', status: 'open' }],
    });

    const { result } = renderHook(() =>
      useOrderSync({ isLoggedIn: false, paperTradingEnabled: true })
    );

    await waitFor(() => {
      expect(result.current.executions).toHaveLength(1);
    });

    expect(result.current.executions[0].symbol).toBe('TCS');
  });

  it('fetches orders from /api/kite/orders when logged in', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ order_id: 'ord-1', status: 'COMPLETE' }],
      });

    const { result } = renderHook(() =>
      useOrderSync({ isLoggedIn: true, paperTradingEnabled: false })
    );

    await waitFor(() => {
      expect(result.current.orders).toHaveLength(1);
    });

    expect(result.current.orders[0].order_id).toBe('ord-1');
  });

  it('fetches GTTs from /api/kite/gtt when logged in', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ id: 1, tradingsymbol: 'INFY' }],
      });

    const { result } = renderHook(() =>
      useOrderSync({ isLoggedIn: true, paperTradingEnabled: false })
    );

    await waitFor(() => {
      expect(result.current.gtts).toHaveLength(1);
    });

    expect(result.current.gtts[0].tradingsymbol).toBe('INFY');
  });

  it('polls every 30s when enabled', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });

    renderHook(() =>
      useOrderSync({ isLoggedIn: true, paperTradingEnabled: false, pollIntervalMs: 30000 })
    );

    // Wait for initial fetch (3 endpoints for logged-in: executions, orders, gtts)
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    // Advance 30s and confirm poll fires again
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(3);
    });
  });

  it('handles 401 by stopping polling (auth lost)', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    });

    const { result } = renderHook(() =>
      useOrderSync({ isLoggedIn: true, paperTradingEnabled: false })
    );

    await waitFor(() => {
      expect(result.current.isPolling).toBe(false);
    });
  });

  it('handles 429 with backoff (does not throw, retries next cycle)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Too many requests' }),
    });

    const { result } = renderHook(() =>
      useOrderSync({ isLoggedIn: true, paperTradingEnabled: false })
    );

    await waitFor(() => {
      expect(result.current.isPolling).toBe(true);
    });

    // Should not throw — error captured in state
    expect(result.current.error).toBeDefined();
  });

  it('cleans up interval on unmount', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });

    const { unmount, result } = renderHook(() =>
      useOrderSync({ isLoggedIn: true, paperTradingEnabled: false, pollIntervalMs: 1000 })
    );

    // Wait for initial fetch to complete
    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    });

    const callCountBefore = fetchMock.mock.calls.length;

    unmount();

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // No new fetches after unmount
    expect(fetchMock.mock.calls.length).toBe(callCountBefore);
    // Avoid unused var warning
    expect(result.current).toBeDefined();
  });

  it('manual refresh() forces immediate fetch', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });

    const { result } = renderHook(() =>
      useOrderSync({ isLoggedIn: true, paperTradingEnabled: false })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const before = fetchMock.mock.calls.length;
    await act(async () => {
      await result.current.refresh();
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThan(before);
  });
});