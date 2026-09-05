/**
 * Universe Service regression tests.
 *
 * Bug: dashboard scanner was running on the 32-ticker hardcoded seed
 * instead of the full NSE DB universe (~450 tickers).
 *
 * Root cause: production /api/tickers returns 404 and the direct Supabase
 * fallback in loadUniverseFromApi also fails (SELECT lists a column that
 * is not in the live schema), so the service silently falls back to the
 * 32-stock SEED_UNIVERSE.
 *
 * Contract: when ANY upstream (API or direct Supabase) returns > 32
 * tickers, the universe service MUST surface those tickers to callers —
 * not silently swap in the 32-ticker seed list.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const supabaseFromMock = vi.fn();
  return {
    supabaseFromMock,
    supabaseMock: { from: supabaseFromMock },
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: mocks.supabaseMock,
}));

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

function makeTickerResponse(count: number) {
  const tickers = Array.from({ length: count }, (_, i) => {
    const idx = i.toString().padStart(3, '0');
    const capCategory = i < 100 ? 'large' : i < 200 ? 'mid' : 'small';
    return {
      symbol: `TST${idx}`,
      company_name: `Test Stock ${idx} Ltd.`,
      sector: 'Test Sector',
      industry: 'Test Industry',
      cap_category: capCategory,
    };
  });
  return { ok: true, status: 200, json: async () => ({ tickers }) };
}

function makeSupabaseRows(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const idx = i.toString().padStart(3, '0');
    const capCategory = i < 100 ? 'large' : i < 200 ? 'mid' : 'small';
    return {
      symbol: `SUP${idx}`,
      company_name: `Supabase Stock ${idx} Ltd.`,
      sector: 'Supabase Sector',
      industry: 'Supabase Industry',
      cap_category: capCategory,
    };
  });
}

/**
 * Build a Supabase query chain that resolves with { data, error }.
 * Mirrors the chain: from(table).select(...).order(...).order(...)
 * where each .order() is awaitable.
 */
function makeSupabaseQueryMock(data: any[] | null, error: any = null) {
  const queryResult = { data, error };
  // Use a thenable that resolves to the data.
  const orderResult: any = {};
  orderResult.order = vi.fn().mockReturnValue(orderResult);
  orderResult.then = (
    resolve: (v: any) => void,
    reject: (e: any) => void
  ) => Promise.resolve(queryResult).then(resolve, reject);
  return {
    select: vi.fn().mockReturnValue(orderResult),
  };
}

async function loadService() {
  vi.resetModules();
  const mod = await import('../universeService');
  return { getUniverse: mod.getUniverse, getUniverseCounts: mod.getUniverseCounts };
}

describe('universeService.getUniverse (DB-driven universe)', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    mocks.supabaseFromMock.mockReset();
  });

  it('returns the full DB universe when /api/tickers returns > 32 tickers (regression: not the 32-stock seed)', async () => {
    const { getUniverse } = await loadService();
    const DB_SIZE = 450;
    fetchMock.mockResolvedValueOnce(makeTickerResponse(DB_SIZE));

    const universe = await getUniverse('all');

    expect(universe.length).toBe(DB_SIZE);
    expect(universe.length).toBeGreaterThan(32);
    expect(universe[0].dataSource).toBe('DB + Seed Prices');
  });

  it('returns the DB universe via direct Supabase when /api/tickers is unavailable (production reality)', async () => {
    const { getUniverse } = await loadService();
    const DB_SIZE = 450;

    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
    mocks.supabaseFromMock.mockReturnValueOnce(
      makeSupabaseQueryMock(makeSupabaseRows(DB_SIZE), null)
    );

    const universe = await getUniverse('all');

    expect(universe.length).toBe(DB_SIZE);
    expect(universe.length).toBeGreaterThan(32);
    expect(universe[0].symbol).toMatch(/^SUP/);
  });

  it('preserves cap-category breakdown from /api/tickers (large/mid/small) when DB is the source', async () => {
    const { getUniverse, getUniverseCounts } = await loadService();
    const DB_SIZE = 450;
    fetchMock.mockResolvedValueOnce(makeTickerResponse(DB_SIZE));

    const universe = await getUniverse('all');
    expect(universe.length).toBe(DB_SIZE);

    const counts = await getUniverseCounts();
    expect(counts.total).toBe(DB_SIZE);
    expect(counts.large).toBeGreaterThan(32);
    expect(counts.mid).toBeGreaterThan(0);
    expect(counts.small).toBeGreaterThan(0);
  });

  it('filters by capCategory from the DB universe, not the seed', async () => {
    const { getUniverse } = await loadService();
    fetchMock.mockResolvedValueOnce(makeTickerResponse(450));

    const large = await getUniverse('large');
    expect(large.length).toBeGreaterThan(0);
    expect(large.every((s) => s.capCategory === 'large')).toBe(true);
  });

  it('does not request a column that is not in the live schema (production 32-ticker bug)', async () => {
    // Repro: production /api/tickers returns 404 → universe service falls
    // through to direct Supabase. The Supabase fallback's SELECT must use
    // only columns that exist in supabase-schema.sql + migrations. Asking
    // for a missing column (e.g. is_fno_default) causes Supabase to throw
    // and the service silently falls back to the 32-ticker SEED_UNIVERSE.
    const { getUniverse } = await loadService();
    const DB_SIZE = 450;

    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
    const selectSpy = vi.fn();
    mocks.supabaseFromMock.mockReturnValueOnce({
      select: selectSpy.mockReturnValue({
        order: vi.fn().mockReturnThis(),
        then: (resolve: any) => Promise.resolve({ data: makeSupabaseRows(DB_SIZE), error: null }).then(resolve),
      }),
    });

    await getUniverse('all');

    // The SELECT must be a parseable list and must not include columns
    // that are absent from the migration (currently is_fno_default).
    const selectArg = selectSpy.mock.calls[0]?.[0] as string | undefined;
    expect(selectArg).toBeDefined();
    const requested = (selectArg as string).split(',').map((c) => c.trim());
    // Migration columns (from supabase/migrations/20250904000004_stock_universe.sql):
    //   symbol, company_name, isin, cap_category, source_list, series,
    //   trading_segment, sector, industry, last_seen_at, created_at, updated_at
    const allowed = new Set([
      'symbol',
      'company_name',
      'isin',
      'cap_category',
      'source_list',
      'series',
      'trading_segment',
      'sector',
      'industry',
      'last_seen_at',
      'created_at',
      'updated_at',
    ]);
    for (const col of requested) {
      expect(allowed.has(col)).toBe(true);
    }
  });
});
