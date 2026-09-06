import type { RawStockData, SectorNavData } from './types';
import { calculateMultiTimeframeReturns, calculateWagnerPedicelliRelativeStrength } from './indicators';
import { getUniverse } from '../services/universeService';

// Deterministic Seeded PRNG for reproducible scan results
export function createSeededRandom(seedStr: string) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 15), 1 | h);
    h = h ^ (h + Math.imul(h ^ (h >>> 7), 61 | h));
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
}

// Helper to generate realistic, deterministic price histories anchored to stock symbol.
// Exported so universeService.ts can re-use the algorithm with the same parameters.
export function generatePriceHistory(
  symbol: string,
  basePrice: number,
  trendPercent: number,
  volatility: number,
  days: number = 200,
  dataSource: 'Zerodha Kite API' | 'yfinance (Yahoo Finance)' = 'yfinance (Yahoo Finance)'
): { prices: number[]; volumeHistory: number[]; sectorNavHistory: number[]; dataSource: string } {
  // Today's date string anchor
  const dateKey = new Date().toISOString().split('T')[0];
  const rand = createSeededRandom(`${symbol}_${dateKey}_${basePrice}`);

  const prices: number[] = [basePrice];
  const volumeHistory: number[] = [];
  const sectorNavHistory: number[] = [100]; // Base 100 for Equal-Weighted Sector NAV

  const dailyTrend = Math.pow(1 + trendPercent / 100, 1 / days) - 1;

  for (let i = 1; i < days; i++) {
    // Random walk with trend drift using seeded PRNG
    const randomNoise = (rand() - 0.47) * volatility;
    const prevPrice = prices[i - 1];
    const newPrice = Math.max(1, prevPrice * (1 + dailyTrend + randomNoise));
    prices.push(Number(newPrice.toFixed(2)));

    // Volume with deterministic spikes on positive days
    const baseVol = Math.floor(rand() * 500000) + 1000000;
    const volMultiplier = randomNoise > 0.01 ? 1.5 + rand() : 0.8 + rand() * 0.4;
    volumeHistory.push(Math.floor(baseVol * volMultiplier));

    // Sector NAV drift
    const sectorNoise = (rand() - 0.49) * (volatility * 0.6);
    const prevNav = sectorNavHistory[i - 1];
    const newNav = Math.max(10, prevNav * (1 + dailyTrend * 0.8 + sectorNoise));
    sectorNavHistory.push(Number(newNav.toFixed(2)));
  }

  return { prices, volumeHistory, sectorNavHistory, dataSource };
}

/**
 * @deprecated The stock universe is now DB-driven via /api/tickers.
 * Use `getUniverse()` from `../services/universeService` instead.
 * This stub remains so `getSectorsNavData()` continues to compile; it
 * returns an empty sector map until DB-driven sector data lands.
 */
export const STOCK_UNIVERSE: RawStockData[] = [];

/**
 * Generate Equal-Weighted Sector NAV Data & Multi-Timeframe Return Metrics (Section 3)
 */
export async function getSectorsNavData(): Promise<SectorNavData[]> {
  const universe = await getUniverse('all');
  const sectorMap = new Map<string, RawStockData[]>();
  universe.forEach((stock) => {
    const list = sectorMap.get(stock.sector) || [];
    list.push(stock);
    sectorMap.set(stock.sector, list);
  });

  const results: SectorNavData[] = [];

  sectorMap.forEach((stocks, sectorName) => {
    const isTji = [
      'Defense & Shipbuilding',
      'Renewable Energy',
      'Electronics Manufacturing',
      'Real Estate',
      'Defense & Aerospace',
      'Chemicals & Agrochemicals',
    ].includes(sectorName);
    const universeType = isTji ? 'Tijori Subsector (TJI)' : 'NSE Sectoral';

    const dayCount = stocks[0].prices.length;
    const equalWeightedNav: number[] = [];

    for (let i = 0; i < dayCount; i++) {
      let sumPctReturn = 0;
      for (const s of stocks) {
        const base = s.prices[0];
        const curr = s.prices[i] || base;
        sumPctReturn += (curr - base) / base;
      }
      const avgReturn = sumPctReturn / stocks.length;
      equalWeightedNav.push(Number((100 * (1 + avgReturn)).toFixed(2)));
    }

    const returns = calculateMultiTimeframeReturns(equalWeightedNav);

    const topConstituents = stocks
      .map((s) => {
        const versus = calculateWagnerPedicelliRelativeStrength(
          s.prices,
          s.sectorNavHistory,
          30
        );
        return {
          symbol: s.symbol,
          name: s.name,
          versusNav: versus,
          price: s.prices[s.prices.length - 1],
        };
      })
      .sort((a, b) => b.versusNav - a.versusNav);

    results.push({
      id: sectorName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      name: sectorName,
      universeType,
      stockCount: stocks.length,
      returns,
      emaAlignment:
        returns.m1 > 0 && returns.m3 > 0
          ? 'Bullish Alignment (20 > 50 > 200)'
          : returns.m1 < 0
          ? 'Bearish'
          : 'Mixed Trend',
      topOutperformingConstituents: topConstituents,
    });
  });

  return results.sort((a, b) => b.returns.m1 - a.returns.m1);
}

/**
 * Parse custom scrip list text input (Section 1.2 / scrip.txt)
 */
export function parseScripsFromText(rawText: string): string[] {
  return rawText
    .split(/[\s,\n\r]+/)
    .map((s) => {
      let clean = s.trim().toUpperCase().replace(/[^A-Z0-9&]/g, '');
      if (clean === 'L&T' || clean === 'LARSEN') clean = 'LT';
      return clean;
    })
    .filter((s) => s.length >= 2);
}
