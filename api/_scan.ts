/**
 * Server-side stock scan with a 15-minute Supabase cache.
 *
 * GET /api/scan?strategy=zerodha-swing&cap=all[&force=1]
 *
 * - If a scan_results row for {strategy,cap} is younger than 15 minutes
 *   (server time, not browser time), return it as-is.
 * - Otherwise (or when ?force=1 from the refetch button), run the strategy
 *   engine over the universe using Upstox historical candles, upsert the
 *   picks to Supabase, and return them.
 *
 * The browser never runs the scan — it only consumes this endpoint.
 */

import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getStrategyById } from '../src/engine/strategies';
import type { RawStockData, StockPick } from '../src/engine/types';
import {
  fetchCandleData,
  generateFallbackCandles,
  UpstoxAuthError,
} from '../src/services/upstoxService';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

const CACHE_TTL_MS = 0; // Fresh refresh on every page load

type ScanRow = {
  id: string;
  strategy_id: string;
  cap_category: string;
  picks: StockPick[];
  data_source: string;
  updated_at: string;
};

async function getCachedScan(id: string): Promise<ScanRow | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from('scan_results')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    // Missing table / RLS hiccup shouldn't kill the scan — degrade to uncached.
    console.warn('[scan] cache read skipped:', error.message);
    return null;
  }
  return (data as ScanRow) || null;
}

async function saveScan(row: ScanRow): Promise<void> {
  if (!supabaseAdmin) return; // dev without Supabase: serve fresh results uncached
  const { error } = await supabaseAdmin.from('scan_results').upsert(row);
  if (error) console.warn('[scan] cache write skipped:', error.message);
}

type UniverseRow = {
  symbol: string;
  company_name: string;
  sector?: string | null;
  industry?: string | null;
  cap_category: string;
  instrument_key?: string | null;
};

type UniverseStock = RawStockData & { instrumentKey?: string | null };

function mapUniverse(rows: UniverseRow[]): UniverseStock[] {
  return rows.map((row) => ({
    symbol: row.symbol,
    name: row.company_name,
    sector: row.sector || 'Unknown',
    industry: row.industry || null,
    capCategory: row.cap_category as 'large' | 'mid' | 'small',
    tradingSegment: row.cap_category === 'small' ? 'Cash Only' : 'F&O Segment',
    marketCapVal:
      row.cap_category === 'large' ? 500000 : row.cap_category === 'mid' ? 75000 : 25000,
    volumeVal: 0,
    prices: [],
    volumeHistory: [],
    sectorNavHistory: [],
    dataSource: 'pending',
    instrumentKey: row.instrument_key,
  }));
}

/** Tiny deterministic universe when Supabase is unavailable (local dev / no rows). */
function loadSeedUniverse(): UniverseStock[] {
  return ['RELIANCE', 'TATASTEEL', 'INFY', 'TATAMOTORS', 'SUZLON', 'BHEL'].map((symbol) => ({
    symbol,
    name: symbol,
    sector: 'Unknown',
    industry: null,
    capCategory: 'large' as const,
    tradingSegment: 'F&O Segment',
    marketCapVal: 500000,
    volumeVal: 0,
    prices: [],
    volumeHistory: [],
    sectorNavHistory: [],
    dataSource: 'pending',
    instrumentKey: null,
  }));
}

/** Universe straight from Supabase (server-side; can't call relative /api/tickers). */
async function loadUniverse(): Promise<UniverseStock[]> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('stock_universe')
      .select('symbol, company_name, sector, industry, cap_category, instrument_key')
      .order('cap_category', { ascending: true })
      .order('symbol', { ascending: true });
    if (error) {
      // Column/table not migrated yet → retry without instrument_key, then seed fallback.
      console.warn('[scan] universe with instrument_key failed:', error.message);
      const retry = await supabaseAdmin
        .from('stock_universe')
        .select('symbol, company_name, sector, industry, cap_category')
        .order('cap_category', { ascending: true })
        .order('symbol', { ascending: true });
      if (retry.error || !retry.data || retry.data.length === 0) {
        console.warn('[scan] universe fallback to seed:', retry.error?.message);
        return loadSeedUniverse();
      }
      return mapUniverse(retry.data.map((row: any) => ({ ...row, instrument_key: null })));
    }
    if (data && data.length > 0) return mapUniverse(data);
  }
  // No Supabase (local dev): tiny deterministic universe so the engine runs.
  return loadSeedUniverse();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const strategyId = (req.query.strategy as string) || 'zerodha-swing';
  const cap = (req.query.cap as string) || 'all';
  const force = req.query.force === '1';
  const rowId = `${strategyId}:${cap}`;

  const strategy = getStrategyById(strategyId);

  try {
    if (!force) {
      const cached = await getCachedScan(rowId);
      if (cached && Date.now() - new Date(cached.updated_at).getTime() < CACHE_TTL_MS) {
        return res.json({
          picks: cached.picks,
          updatedAt: cached.updated_at,
          dataSource: cached.data_source,
          cached: true,
        });
      }
    }

    // ---- Stale or forced: run the scan ------------------------------------
    const universe = (await loadUniverse()).filter(
      (s) => cap === 'all' || s.capCategory === cap
    );

    let sawAuthError = false;
    let liveCount = 0;
    const picks: StockPick[] = [];

    // ponytail: sequential per-stock fetch keeps us inside Upstox rate
    // limits; upgrade to chunked Promise.all if scan time becomes a problem.
    for (const stock of universe) {
      let data;
      try {
        if (stock.instrumentKey) {
          data = await fetchCandleData(stock.instrumentKey);
          liveCount++;
        } else {
          // No instrument key mapped — deterministic synthetic candles.
          let h = 0;
          for (const ch of stock.symbol) h = (h * 31 + ch.charCodeAt(0)) | 0;
          data = generateFallbackCandles(Math.abs(h));
        }
      } catch (err) {
        if (err instanceof UpstoxAuthError) {
          sawAuthError = true;
          data = generateFallbackCandles(1);
        } else {
          console.error(`[scan] ${stock.symbol}:`, err);
          data = generateFallbackCandles(1);
        }
      }

      stock.prices = data.prices;
      stock.volumeHistory = data.volumeHistory;
      stock.sectorNavHistory = data.sectorNavHistory;
      stock.dataSource = data.dataSource;

      try {
        const pick = strategy.execute(stock);
        if (pick) picks.push(pick);
      } catch (err) {
        console.error(`[scan] strategy error for ${stock.symbol}:`, err);
      }
    }

    const dataSource = sawAuthError
      ? 'Upstox (token expired)'
      : liveCount > 0
        ? 'Upstox'
        : 'Fallback';

    const row: ScanRow = {
      id: rowId,
      strategy_id: strategyId,
      cap_category: cap,
      picks,
      data_source: dataSource,
      updated_at: new Date().toISOString(),
    };
    await saveScan(row);

    return res.json({
      picks,
      updatedAt: row.updated_at,
      dataSource,
      cached: false,
      upstoxAuthError: sawAuthError,
    });
  } catch (err: any) {
    console.error('[scan] failed:', err);
    return res.status(500).json({ error: err?.message || 'Scan failed' });
  }
}

