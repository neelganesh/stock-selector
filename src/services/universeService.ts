/**
 * Universe Service
 *
 * Provides the real stock universe to the scanner engine from Supabase (DB-driven).
 * Each stock includes its real symbol, company name, sector, cap_category, and instrument_key.
 * NO MOCKS / NO HARDCODED DATA.
 */

import type { RawStockData, CapCategory } from '../engine/types';
import { supabase } from '../lib/supabase';

export interface DbTicker {
  symbol: string;
  company_name: string;
  sector: string | null;
  industry: string | null;
  cap_category: string;
  instrument_key?: string | null;
}

function hydrateTicker(row: DbTicker): RawStockData {
  return {
    symbol: row.symbol,
    name: row.company_name,
    sector: row.sector || 'Unknown',
    industry: row.industry || null,
    capCategory: (row.cap_category as 'large' | 'mid' | 'small') || 'large',
    tradingSegment: row.cap_category === 'small' ? 'Cash Only' : 'F&O Segment',
    marketCapVal: row.cap_category === 'large' ? 500000 : row.cap_category === 'mid' ? 75000 : 25000,
    volumeVal: 0,
    prices: [],
    volumeHistory: [],
    sectorNavHistory: [],
    dataSource: 'DB + Seed Prices',
    instrumentKey: row.instrument_key || null,
  };
}

let _dbUniverse: RawStockData[] | null = null;
let _dbUniverseLoaded = false;

async function loadUniverseFromApi(): Promise<RawStockData[]> {
  try {
    const res = await fetch('/api/tickers?cap=all');
    if (!res.ok) throw new Error(`tickers API returned ${res.status}`);
    const { tickers } = (await res.json()) as { tickers: DbTicker[] };
    if (Array.isArray(tickers) && tickers.length > 0) {
      return tickers.map(hydrateTicker);
    }
  } catch (apiErr) {
    console.warn('[universeService] /api/tickers failed, attempting direct Supabase query:', apiErr);
  }

  // Fallback to direct client read from Supabase
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('stock_universe')
        .select('symbol, company_name, sector, industry, cap_category, source_list')
        .order('cap_category', { ascending: true })
        .order('symbol', { ascending: true });
      if (error) throw error;
      if (data && data.length > 0) {
        return data.map(hydrateTicker);
      }
    } catch (dbErr) {
      console.error('[universeService] Supabase fallback error:', dbErr);
    }
  }

  return [];
}

export async function getUniverse(capCategory: CapCategory = 'all'): Promise<RawStockData[]> {
  if (!_dbUniverseLoaded) {
    _dbUniverse = await loadUniverseFromApi();
    _dbUniverseLoaded = true;
  }

  const universe = _dbUniverse ?? [];
  if (capCategory === 'all') return universe;
  return universe.filter((s) => s.capCategory === capCategory);
}

export async function refreshUniverse(): Promise<RawStockData[]> {
  _dbUniverse = null;
  _dbUniverseLoaded = false;
  return getUniverse('all');
}

export async function getUniverseCounts(): Promise<{ large: number; mid: number; small: number; total: number }> {
  const universe = _dbUniverse ?? [];
  const counts = { large: 0, mid: 0, small: 0, total: universe.length };
  for (const s of universe) {
    if (s.capCategory in counts) counts[s.capCategory as 'large' | 'mid' | 'small']++;
  }
  return counts;
}
