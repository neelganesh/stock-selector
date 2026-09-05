/**
 * Universe Service
 *
 * Provides the stock universe to the scanner engine from Supabase (DB-driven).
 * Falls back to hardcoded seed data if Supabase is unreachable (dev/test).
 *
 * The DB source is populated by:
 *   - scripts/load-nse-universe.mjs  (one-shot)
 *   - api/admin/refresh-universe.ts  (cron / manual trigger)
 *
 * Usage:
 *   import { getUniverse } from '../services/universeService';
 *   const universe = await getUniverse('large');
 */

import type { RawStockData, CapCategory } from '../engine/types';
import { createSeededRandom } from '../engine/universe';
import { supabase } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Seed data (used when Supabase is unreachable)
// ---------------------------------------------------------------------------
// Keep in sync with the hardcoded list in src/engine/universe.ts
// until the DB is populated. Once the DB is loaded, this fallback is only
// used in dev/test environments without Supabase access.
const SEED_UNIVERSE: Array<Omit<RawStockData, 'prices' | 'volumeHistory' | 'sectorNavHistory' | 'dataSource'>> = [
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd.', sector: 'Energy & Oil', capCategory: 'large', tradingSegment: 'F&O Segment', marketCapVal: 1650000, volumeVal: 8200000 },
  { symbol: 'TATASTEEL', name: 'Tata Steel Ltd.', sector: 'Metals & Mining', capCategory: 'large', tradingSegment: 'F&O Segment', marketCapVal: 175000, volumeVal: 15400000 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd.', sector: 'Financial Services', capCategory: 'large', tradingSegment: 'F&O Segment', marketCapVal: 1280000, volumeVal: 6800000 },
  { symbol: 'INFY', name: 'Infosys Ltd.', sector: 'Information Technology', capCategory: 'large', tradingSegment: 'F&O Segment', marketCapVal: 610000, volumeVal: 4200000 },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd.', sector: 'Financial Services', capCategory: 'large', tradingSegment: 'F&O Segment', marketCapVal: 840000, volumeVal: 7500000 },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd.', sector: 'Telecommunication', capCategory: 'large', tradingSegment: 'F&O Segment', marketCapVal: 780000, volumeVal: 5600000 },
  { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd.', sector: 'Automobile', capCategory: 'large', tradingSegment: 'F&O Segment', marketCapVal: 320000, volumeVal: 11200000 },
  { symbol: 'LT', name: 'Larsen & Toubro Ltd.', sector: 'Capital Goods', capCategory: 'large', tradingSegment: 'F&O Segment', marketCapVal: 480000, volumeVal: 3100000 },
  { symbol: 'ITC', name: 'ITC Ltd.', sector: 'FMCG', capCategory: 'large', tradingSegment: 'F&O Segment', marketCapVal: 560000, volumeVal: 9800000 },
  { symbol: 'SBIN', name: 'State Bank of India', sector: 'Financial Services', capCategory: 'large', tradingSegment: 'F&O Segment', marketCapVal: 690000, volumeVal: 14500000 },
  { symbol: 'ADANIENT', name: 'Adani Enterprises Ltd.', sector: 'Metals & Mining', capCategory: 'large', tradingSegment: 'F&O Segment', marketCapVal: 360000, volumeVal: 4800000 },
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical Industries', sector: 'Healthcare', capCategory: 'large', tradingSegment: 'F&O Segment', marketCapVal: 390000, volumeVal: 2900000 },
  { symbol: 'POLYCAB', name: 'Polycab India Ltd.', sector: 'Capital Goods', capCategory: 'mid', tradingSegment: 'F&O Segment', marketCapVal: 92000, volumeVal: 1800000 },
  { symbol: 'PERSISTENT', name: 'Persistent Systems Ltd.', sector: 'Information Technology', capCategory: 'mid', tradingSegment: 'F&O Segment', marketCapVal: 68000, volumeVal: 1200000 },
  { symbol: 'TRENT', name: 'Trent Ltd.', sector: 'Consumer Services', capCategory: 'mid', tradingSegment: 'F&O Segment', marketCapVal: 180000, volumeVal: 2400000 },
  { symbol: 'COFORGE', name: 'Coforge Ltd.', sector: 'Information Technology', capCategory: 'mid', tradingSegment: 'F&O Segment', marketCapVal: 38000, volumeVal: 850000 },
  { symbol: 'VOLTAS', name: 'Voltas Ltd.', sector: 'Consumer Durables', capCategory: 'mid', tradingSegment: 'F&O Segment', marketCapVal: 45000, volumeVal: 3200000 },
  { symbol: 'DIXON', name: 'Dixon Technologies India', sector: 'Consumer Durables', capCategory: 'mid', tradingSegment: 'F&O Segment', marketCapVal: 52000, volumeVal: 1100000 },
  { symbol: 'MUTHOOTFIN', name: 'Muthoot Finance Ltd.', sector: 'Financial Services', capCategory: 'mid', tradingSegment: 'F&O Segment', marketCapVal: 64000, volumeVal: 1900000 },
  { symbol: 'AUROPHARMA', name: 'Aurobindo Pharma Ltd.', sector: 'Healthcare', capCategory: 'mid', tradingSegment: 'F&O Segment', marketCapVal: 69000, volumeVal: 2800000 },
  { symbol: 'BHEL', name: 'Bharat Heavy Electricals Ltd.', sector: 'Capital Goods', capCategory: 'mid', tradingSegment: 'F&O Segment', marketCapVal: 88000, volumeVal: 18500000 },
  { symbol: 'CUMMINSIND', name: 'Cummins India Ltd.', sector: 'Capital Goods', capCategory: 'mid', tradingSegment: 'F&O Segment', marketCapVal: 82000, volumeVal: 1600000 },
  { symbol: 'MAZDOCK', name: 'Mazagon Dock Shipbuilders', sector: 'Defense & Shipbuilding', capCategory: 'small', tradingSegment: 'Cash Only', marketCapVal: 48000, volumeVal: 6200000 },
  { symbol: 'SUZLON', name: 'Suzlon Energy Ltd.', sector: 'Renewable Energy', capCategory: 'small', tradingSegment: 'Cash Only', marketCapVal: 65000, volumeVal: 42000000 },
  { symbol: 'BSE', name: 'BSE Ltd.', sector: 'Financial Services', capCategory: 'small', tradingSegment: 'Cash Only', marketCapVal: 32000, volumeVal: 4100000 },
  { symbol: 'DATAPATT', name: 'Data Patterns India Ltd.', sector: 'Defense & Aerospace', capCategory: 'small', tradingSegment: 'Cash Only', marketCapVal: 16000, volumeVal: 1400000 },
  { symbol: 'CGPOWER', name: 'CG Power & Industrial Solutions', sector: 'Capital Goods', capCategory: 'small', tradingSegment: 'Cash Only', marketCapVal: 72000, volumeVal: 3800000 },
  { symbol: 'KAYNES', name: 'Kaynes Technology India Ltd.', sector: 'Electronics Manufacturing', capCategory: 'small', tradingSegment: 'Cash Only', marketCapVal: 18000, volumeVal: 920000 },
  { symbol: 'ANANTRAJ', name: 'Anant Raj Ltd.', sector: 'Real Estate', capCategory: 'small', tradingSegment: 'Cash Only', marketCapVal: 12500, volumeVal: 2200000 },
  { symbol: 'KFINTECH', name: 'KFin Technologies Ltd.', sector: 'Financial Technology', capCategory: 'small', tradingSegment: 'Cash Only', marketCapVal: 11000, volumeVal: 1300000 },
  { symbol: 'TEJASNET', name: 'Tejas Networks Ltd.', sector: 'Telecommunication', capCategory: 'small', tradingSegment: 'Cash Only', marketCapVal: 15000, volumeVal: 2700000 },
  { symbol: 'RCF', name: 'Rashtriya Chemicals & Fertilisers', sector: 'Chemicals & Agrochemicals', capCategory: 'small', tradingSegment: 'Cash Only', marketCapVal: 8500, volumeVal: 3500000 },
];

// ---------------------------------------------------------------------------
// Seed price generator (same algorithm as universe.ts, for compatibility)
// ---------------------------------------------------------------------------

/**
 * Generate deterministic price history for a symbol, used when real OHLCV
 * data is not available (dev/test / pre-DB-populate phase).
 * Mirrors `generatePriceHistory` in src/engine/universe.ts so results are
 * consistent regardless of which side calls it.
 */
function generateSeedPrices(symbol: string, basePrice: number, trendPct: number, volatility: number) {
  const dateKey = new Date().toISOString().split('T')[0];
  const rand = createSeededRandom(`${symbol}_${dateKey}_${basePrice}`);
  const prices: number[] = [basePrice];
  const volumeHistory: number[] = [];
  const sectorNavHistory: number[] = [100];

  const dailyTrend = Math.pow(1 + trendPct / 100, 1 / 200) - 1;

  for (let i = 1; i < 200; i++) {
    const randomNoise = (rand() - 0.47) * volatility;
    const newPrice = Math.max(1, prices[i - 1] * (1 + dailyTrend + randomNoise));
    prices.push(Number(newPrice.toFixed(2)));

    const baseVol = Math.floor(rand() * 500000) + 1000000;
    const volMultiplier = randomNoise > 0.01 ? 1.5 + rand() : 0.8 + rand() * 0.4;
    volumeHistory.push(Math.floor(baseVol * volMultiplier));

    const sectorNoise = (rand() - 0.49) * (volatility * 0.6);
    const newNav = Math.max(10, sectorNavHistory[i - 1] * (1 + dailyTrend * 0.8 + sectorNoise));
    sectorNavHistory.push(Number(newNav.toFixed(2)));
  }

  return { prices, volumeHistory, sectorNavHistory };
}

// ---------------------------------------------------------------------------
// Base prices map (for deterministic seed generation)
// ---------------------------------------------------------------------------
// Used to generate stable seed prices without real market data.
const BASE_PRICES: Record<string, number> = {
  RELIANCE: 2200, TATASTEEL: 125, HDFCBANK: 1550, INFY: 1400,
  ICICIBANK: 1050, BHARTIARTL: 1200, TATAMOTORS: 820, LT: 3100,
  ITC: 410, SBIN: 720, ADANIENT: 2800, SUNPHARMA: 1480,
  POLYCAB: 5400, PERSISTENT: 3800, TRENT: 4200, COFORGE: 5200,
  VOLTAS: 1280, DIXON: 7800, MUTHOOTFIN: 1600, AUROPHARMA: 1150,
  BHEL: 245, CUMMINSIND: 2900, MAZDOCK: 2300, SUZLON: 48,
  BSE: 2400, DATAPATT: 2800, CGPOWER: 480, KAYNES: 3100,
  ANANTRAJ: 360, KFINTECH: 680, TEJASNET: 920, RCF: 155,
};

// ---------------------------------------------------------------------------
// Seed universe cache (module-level, per session)
// ---------------------------------------------------------------------------
let _seedUniverse: RawStockData[] | null = null;

function buildSeedUniverse(): RawStockData[] {
  if (_seedUniverse) return _seedUniverse;
  _seedUniverse = SEED_UNIVERSE.map((stock) => {
    const basePrice = BASE_PRICES[stock.symbol] ?? 500;
    const trend = (stock.capCategory === 'large' ? 12 : stock.capCategory === 'mid' ? 20 : 35);
    const vol = stock.capCategory === 'large' ? 0.013 : stock.capCategory === 'mid' ? 0.020 : 0.030;
    const { prices, volumeHistory, sectorNavHistory } = generateSeedPrices(stock.symbol, basePrice, trend, vol);
    return {
      ...stock,
      prices,
      volumeHistory,
      sectorNavHistory,
      dataSource: 'Seed (pre-DB)',
    };
  });
  return _seedUniverse;
}

// ---------------------------------------------------------------------------
// DB universe (fetched once per session, cached)
// ---------------------------------------------------------------------------
let _dbUniverse: RawStockData[] | null = null;
let _dbUniverseLoaded = false;

interface DbTicker {
  symbol: string;
  company_name: string;
  sector: string | null;
  industry: string | null;
  cap_category: string;
}

/**
 * Hydrate a DB ticker row into a RawStockData with seed-generated price history.
 * Real OHLCV will be fetched live during scan; this provides the seed structure.
 */
function hydrateTicker(row: DbTicker): RawStockData {
  const basePrice = BASE_PRICES[row.symbol] ?? Math.floor(Math.random() * 5000 + 100);
  const trend = row.cap_category === 'large' ? 12 : row.cap_category === 'mid' ? 20 : 35;
  const vol = row.cap_category === 'large' ? 0.013 : row.cap_category === 'mid' ? 0.020 : 0.030;
  const { prices, volumeHistory, sectorNavHistory } = generateSeedPrices(row.symbol, basePrice, trend, vol);
  // Default market cap / volume for new DB tickers (will be replaced when
  // real Kite/yfinance data flows in. Strategies only use these for filtering.)
  const marketCapVal = row.cap_category === 'large' ? 500000 : row.cap_category === 'mid' ? 75000 : 25000;
  const volumeVal = row.cap_category === 'large' ? 5000000 : row.cap_category === 'mid' ? 2000000 : 3000000;
  return {
    symbol: row.symbol,
    name: row.company_name,
    sector: row.sector || 'Unknown',
    industry: row.industry || null,
    capCategory: row.cap_category as 'large' | 'mid' | 'small',
    tradingSegment: 'F&O Segment',
    marketCapVal,
    volumeVal,
    prices,
    volumeHistory,
    sectorNavHistory,
    dataSource: 'DB + Seed Prices',
  };
}

/**
 * Load all tickers from the /api/tickers endpoint.
 * Falls back to a direct Supabase read on 404 (production deploys can
 * lag the latest serverless function). Falls back to seed data only
 * if both paths fail (no internet / no Supabase credentials).
 */
async function loadUniverseFromApi(): Promise<RawStockData[]> {
  try {
    const res = await fetch('/api/tickers?cap=all');
    if (!res.ok) throw new Error(`tickers API returned ${res.status}`);
    const { tickers } = (await res.json()) as { tickers: DbTicker[] };
    return tickers.map(hydrateTicker);
  } catch (apiErr) {
    // Serverless endpoint is missing or stale. Try direct Supabase read.
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
        console.warn('[universeService] Supabase fallback also failed, using seed data:', dbErr);
      }
    }
    console.warn('[universeService] /api/tickers failed, using seed data:', apiErr);
    return buildSeedUniverse();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the full stock universe (or filtered by cap category).
 *
 * Uses DB source when available (~450 tickers from NSE), falls back to
 * the 32 seed stocks (pre-DB-populate mode).
 *
 * The result is cached per session — subsequent calls return the same
 * array without re-fetching.
 *
 * @param capCategory  Filter by 'large' | 'mid' | 'small' | 'all'. Default 'all'.
 */
export async function getUniverse(capCategory: CapCategory = 'all'): Promise<RawStockData[]> {
  if (!_dbUniverseLoaded) {
    _dbUniverse = await loadUniverseFromApi();
    _dbUniverseLoaded = true;
  }

  const universe = _dbUniverse ?? buildSeedUniverse();

  if (capCategory === 'all') return universe;
  return universe.filter((s) => s.capCategory === capCategory);
}

/**
 * Force a refresh of the cached universe.
 * Call this after the user triggers a "Refresh Universe" in settings.
 */
export async function refreshUniverse(): Promise<RawStockData[]> {
  _dbUniverse = null;
  _dbUniverseLoaded = false;
  return getUniverse('all');
}

/**
 * Get a count summary of the current universe by cap category.
 */
export async function getUniverseCounts(): Promise<{ large: number; mid: number; small: number; total: number }> {
  const universe = _dbUniverse ?? buildSeedUniverse();
  const counts = { large: 0, mid: 0, small: 0, total: universe.length };
  for (const s of universe) {
    if (s.capCategory in counts) counts[s.capCategory as 'large' | 'mid' | 'small']++;
  }
  return counts;
}
