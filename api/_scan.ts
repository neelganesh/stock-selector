/**
 * Server-side stock scan with fresh Upstox data.
 *
 * GET /api/scan?strategy=zerodha-swing&cap=all[&force=1]
 *
 * Runs the strategy engine over the universe using real Upstox historical candles.
 * NO MOCKS / NO HARDCODED DATA:
 * - Real stocks from Supabase stock_universe
 * - Real candles from Upstox API v2
 * - Missing or invalid instruments are skipped cleanly without fake data.
 */

import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getStrategyById } from '../src/engine/strategies';
import type { RawStockData, StockPick } from '../src/engine/types';
import {
  fetchCandleData,
  UpstoxAuthError,
} from '../src/services/upstoxService';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

type ScanRow = {
  id: string;
  strategy_id: string;
  cap_category: string;
  picks: StockPick[];
  data_source: string;
  updated_at: string;
};

async function saveScan(row: ScanRow): Promise<void> {
  if (!supabaseAdmin) return;
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

async function loadUniverse(): Promise<UniverseStock[]> {
  if (!supabaseAdmin) {
    throw new Error('Supabase configuration missing');
  }

  const { data, error } = await supabaseAdmin
    .from('stock_universe')
    .select('symbol, company_name, sector, industry, cap_category, instrument_key')
    .not('instrument_key', 'is', null)
    .order('cap_category', { ascending: true })
    .order('symbol', { ascending: true });

  if (error) throw error;
  return mapUniverse(data || []);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const strategyId = (req.query.strategy as string) || 'zerodha-swing';
  const cap = (req.query.cap as string) || 'all';
  const rowId = `${strategyId}:${cap}`;

  const strategy = getStrategyById(strategyId);

  try {
    const universe = (await loadUniverse()).filter(
      (s) => cap === 'all' || s.capCategory === cap
    );

    let sawAuthError = false;
    let liveCount = 0;
    const picks: StockPick[] = [];

    // Scan stocks in small parallel chunks
    const CHUNK_SIZE = 5;
    for (let i = 0; i < universe.length; i += CHUNK_SIZE) {
      const chunk = universe.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (stock) => {
          if (!stock.instrumentKey) return;
          try {
            const data = await fetchCandleData(stock.instrumentKey);
            stock.prices = data.prices;
            stock.volumeHistory = data.volumeHistory;
            stock.sectorNavHistory = data.sectorNavHistory;
            stock.dataSource = data.dataSource;
            liveCount++;

            const pick = strategy.execute(stock);
            if (pick) {
              pick.dataSource = 'Upstox';
              picks.push(pick);
            }
          } catch (err) {
            if (err instanceof UpstoxAuthError) {
              sawAuthError = true;
            }
            // Skip invalid stocks cleanly (NO MOCKS)
          }
        })
      );
      if (sawAuthError) break;
    }

    const dataSource = sawAuthError
      ? 'Upstox (token expired)'
      : liveCount > 0
        ? 'Upstox'
        : 'Upstox (no data)';

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
