import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fetchCandleData,
  UpstoxAuthError,
} from '../upstoxService';

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

  it('throws on insufficient candles', async () => {
    vi.stubEnv('UPSTOX_ACCESS_TOKEN', 'test-token');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { candles: [[1, 2, 3, 4, 5, 6, 7]] } }),
      } as any)
    );
    await expect(fetchCandleData('NSE_EQ|INE002A01018')).rejects.toThrow('Insufficient candles');
  });

  it('reverses descending Upstox candles to chronological order (oldest first)', async () => {
    vi.stubEnv('UPSTOX_ACCESS_TOKEN', 'test-token');
    // Descending from Upstox: [0] is newest (55), [59] is oldest (100)
    const candles = Array.from({ length: 60 }, (_, i) => [
      `2026-09-${String(60 - i).padStart(2, '0')}`,
      100 - i,
      105 - i,
      95 - i,
      100 - i, // close
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
    // Prices must be chronological (oldest first): 100 - 59 = 41 up to 100 - 0 = 100
    expect(d.prices[0]).toBe(41);
    expect(d.prices[d.prices.length - 1]).toBe(100);
    expect(d.prices).toHaveLength(60);
    expect(d.volumeHistory).toHaveLength(60);
    expect(d.sectorNavHistory).toHaveLength(60);
    expect(d.dataSource).toBe('Upstox');
  });
});
