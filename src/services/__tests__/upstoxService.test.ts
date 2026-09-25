/**
 * Minimal checks for the Upstox service (AGENTS.md: one runnable check).
 *
 * - generateFallbackCandles is deterministic per seed (api/scan.ts relies
 *   on this: a stock without an instrument key must always get the same
 *   synthetic series).
 * - fetchCandleData maps Upstox candles → CandleData contract and maps a
 *   401 to UpstoxAuthError.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fetchCandleData,
  generateFallbackCandles,
  UpstoxAuthError,
} from '../upstoxService';

describe('generateFallbackCandles', () => {
  it('is deterministic for the same seed', () => {
    const a = generateFallbackCandles(12345);
    const b = generateFallbackCandles(12345);
    expect(a.prices).toEqual(b.prices);
    expect(a.volumeHistory).toEqual(b.volumeHistory);
  });

  it('produces the contract shape: 260 candles with nav one-per-return', () => {
    const d = generateFallbackCandles(7);
    expect(d.prices).toHaveLength(260);
    expect(d.volumeHistory).toHaveLength(260);
    expect(d.sectorNavHistory).toHaveLength(259);
    expect(d.dataSource).toBe('Fallback');
  });
});

describe('fetchCandleData', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('maps a 401 to UpstoxAuthError', async () => {
    vi.stubEnv('UPSTOX_ACCESS_TOKEN', 'test-token');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 401, ok: false } as any)
    );
    await expect(fetchCandleData('NSE_EQ|INE002A01018')).rejects.toBeInstanceOf(
      UpstoxAuthError
    );
  });

  it('maps Upstox candles to closes/volumes/nav', async () => {
    vi.stubEnv('UPSTOX_ACCESS_TOKEN', 'test-token');
    const candles = Array.from({ length: 25 }, (_, i) => [
      `2025-01-${String(i + 1).padStart(2, '0')}`,
      100 + i,
      105 + i,
      95 + i,
      101 + i,
      1000 + i,
      0,
    ]);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { candles } }),
      } as any)
    );
    const d = await fetchCandleData('NSE_EQ|INE002A01018');
    expect(d.prices).toEqual(candles.map((c) => c[4]));
    expect(d.volumeHistory).toEqual(candles.map((c) => c[5]));
    expect(d.sectorNavHistory).toHaveLength(24);
    expect(d.dataSource).toBe('Upstox');
  });
});
