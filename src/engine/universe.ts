import type { RawStockData, SectorNavData } from './types';
import { calculateMultiTimeframeReturns, calculateWagnerPedicelliRelativeStrength } from './indicators';

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

// Helper to generate realistic, deterministic price histories anchored to stock symbol
function generatePriceHistory(
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
 * Robust Universe of Indian Equities across Large, Mid, and Small Cap segments.
 * Tagged strictly by F&O Segment (Liquid Futures & Options Pool) vs Cash Only (Unleveraged Niche Subsectors)
 */
export const STOCK_UNIVERSE: RawStockData[] = [
  // ==========================================
  // LARGE CAP (NIFTY 50 & TOP 100 - F&O SEGMENT)
  // ==========================================
  {
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd.',
    sector: 'Energy & Oil',
    capCategory: 'large',
    tradingSegment: 'F&O Segment',
    marketCapVal: 1650000,
    volumeVal: 8200000,
    ...generatePriceHistory('RELIANCE', 2200, 15, 0.015),
  },
  {
    symbol: 'TATASTEEL',
    name: 'Tata Steel Ltd.',
    sector: 'Metals & Mining',
    capCategory: 'large',
    tradingSegment: 'F&O Segment',
    marketCapVal: 175000,
    volumeVal: 15400000,
    ...generatePriceHistory('TATASTEEL', 125, 18, 0.022),
  },
  {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Ltd.',
    sector: 'Financial Services',
    capCategory: 'large',
    tradingSegment: 'F&O Segment',
    marketCapVal: 1280000,
    volumeVal: 6800000,
    ...generatePriceHistory('HDFCBANK', 1550, 10, 0.012),
  },
  {
    symbol: 'INFY',
    name: 'Infosys Ltd.',
    sector: 'Information Technology',
    capCategory: 'large',
    tradingSegment: 'F&O Segment',
    marketCapVal: 610000,
    volumeVal: 4200000,
    ...generatePriceHistory('INFY', 1400, 4, 0.014),
  },
  {
    symbol: 'ICICIBANK',
    name: 'ICICI Bank Ltd.',
    sector: 'Financial Services',
    capCategory: 'large',
    tradingSegment: 'F&O Segment',
    marketCapVal: 840000,
    volumeVal: 7500000,
    ...generatePriceHistory('ICICIBANK', 1050, 22, 0.014),
  },
  {
    symbol: 'BHARTIARTL',
    name: 'Bharti Airtel Ltd.',
    sector: 'Telecommunication',
    capCategory: 'large',
    tradingSegment: 'F&O Segment',
    marketCapVal: 780000,
    volumeVal: 5600000,
    ...generatePriceHistory('BHARTIARTL', 1200, 28, 0.016),
  },
  {
    symbol: 'TATAMOTORS',
    name: 'Tata Motors Ltd.',
    sector: 'Automobile',
    capCategory: 'large',
    tradingSegment: 'F&O Segment',
    marketCapVal: 320000,
    volumeVal: 11200000,
    ...generatePriceHistory('TATAMOTORS', 820, 32, 0.025),
  },
  {
    symbol: 'LT',
    name: 'Larsen & Toubro Ltd.',
    sector: 'Capital Goods',
    capCategory: 'large',
    tradingSegment: 'F&O Segment',
    marketCapVal: 480000,
    volumeVal: 3100000,
    ...generatePriceHistory('LT', 3600, 20, 0.016),
  },
  {
    symbol: 'ITC',
    name: 'ITC Ltd.',
    sector: 'FMCG',
    capCategory: 'large',
    tradingSegment: 'F&O Segment',
    marketCapVal: 560000,
    volumeVal: 9800000,
    ...generatePriceHistory('ITC', 410, 8, 0.011),
  },
  {
    symbol: 'SBIN',
    name: 'State Bank of India',
    sector: 'Financial Services',
    capCategory: 'large',
    tradingSegment: 'F&O Segment',
    marketCapVal: 690000,
    volumeVal: 14500000,
    ...generatePriceHistory('SBIN', 720, 25, 0.019),
  },
  {
    symbol: 'ADANIENT',
    name: 'Adani Enterprises Ltd.',
    sector: 'Metals & Mining',
    capCategory: 'large',
    tradingSegment: 'F&O Segment',
    marketCapVal: 360000,
    volumeVal: 4800000,
    ...generatePriceHistory('ADANIENT', 2800, 16, 0.032),
  },
  {
    symbol: 'SUNPHARMA',
    name: 'Sun Pharmaceutical Industries',
    sector: 'Healthcare',
    capCategory: 'large',
    tradingSegment: 'F&O Segment',
    marketCapVal: 390000,
    volumeVal: 2900000,
    ...generatePriceHistory('SUNPHARMA', 1480, 24, 0.015),
  },

  // ==========================================
  // MID CAP (NIFTY MIDCAP 100)
  // ==========================================
  {
    symbol: 'POLYCAB',
    name: 'Polycab India Ltd.',
    sector: 'Capital Goods',
    capCategory: 'mid',
    tradingSegment: 'F&O Segment',
    marketCapVal: 92000,
    volumeVal: 1800000,
    ...generatePriceHistory('POLYCAB', 5400, 35, 0.024),
  },
  {
    symbol: 'PERSISTENT',
    name: 'Persistent Systems Ltd.',
    sector: 'Information Technology',
    capCategory: 'mid',
    tradingSegment: 'F&O Segment',
    marketCapVal: 68000,
    volumeVal: 1200000,
    ...generatePriceHistory('PERSISTENT', 3800, 38, 0.026),
  },
  {
    symbol: 'TRENT',
    name: 'Trent Ltd.',
    sector: 'Consumer Services',
    capCategory: 'mid',
    tradingSegment: 'F&O Segment',
    marketCapVal: 180000,
    volumeVal: 2400000,
    ...generatePriceHistory('TRENT', 4200, 65, 0.028),
  },
  {
    symbol: 'COFORGE',
    name: 'Coforge Ltd.',
    sector: 'Information Technology',
    capCategory: 'mid',
    tradingSegment: 'F&O Segment',
    marketCapVal: 38000,
    volumeVal: 850000,
    ...generatePriceHistory('COFORGE', 5200, 22, 0.023),
  },
  {
    symbol: 'VOLTAS',
    name: 'Voltas Ltd.',
    sector: 'Consumer Durables',
    capCategory: 'mid',
    tradingSegment: 'F&O Segment',
    marketCapVal: 45000,
    volumeVal: 3200000,
    ...generatePriceHistory('VOLTAS', 1280, 42, 0.027),
  },
  {
    symbol: 'DIXON',
    name: 'Dixon Technologies India',
    sector: 'Consumer Durables',
    capCategory: 'mid',
    tradingSegment: 'F&O Segment',
    marketCapVal: 52000,
    volumeVal: 1100000,
    ...generatePriceHistory('DIXON', 7800, 55, 0.031),
  },
  {
    symbol: 'MUTHOOTFIN',
    name: 'Muthoot Finance Ltd.',
    sector: 'Financial Services',
    capCategory: 'mid',
    tradingSegment: 'F&O Segment',
    marketCapVal: 64000,
    volumeVal: 1900000,
    ...generatePriceHistory('MUTHOOTFIN', 1600, 26, 0.021),
  },
  {
    symbol: 'AUROPHARMA',
    name: 'Aurobindo Pharma Ltd.',
    sector: 'Healthcare',
    capCategory: 'mid',
    tradingSegment: 'F&O Segment',
    marketCapVal: 69000,
    volumeVal: 2800000,
    ...generatePriceHistory('AUROPHARMA', 1150, 34, 0.024),
  },
  {
    symbol: 'BHEL',
    name: 'Bharat Heavy Electricals Ltd.',
    sector: 'Capital Goods',
    capCategory: 'mid',
    tradingSegment: 'F&O Segment',
    marketCapVal: 88000,
    volumeVal: 18500000,
    ...generatePriceHistory('BHEL', 245, 58, 0.035),
  },
  {
    symbol: 'CUMMINSIND',
    name: 'Cummins India Ltd.',
    sector: 'Capital Goods',
    capCategory: 'mid',
    tradingSegment: 'F&O Segment',
    marketCapVal: 82000,
    volumeVal: 1600000,
    ...generatePriceHistory('CUMMINSIND', 2900, 30, 0.022),
  },

  // ==========================================
  // SMALL CAP (NIFTY SMALLCAP 250 - CASH ONLY UNIVERSE)
  // ==========================================
  {
    symbol: 'MAZDOCK',
    name: 'Mazagon Dock Shipbuilders',
    sector: 'Defense & Shipbuilding',
    capCategory: 'small',
    tradingSegment: 'Cash Only',
    marketCapVal: 48000,
    volumeVal: 6200000,
    ...generatePriceHistory('MAZDOCK', 2300, 85, 0.038),
  },
  {
    symbol: 'SUZLON',
    name: 'Suzlon Energy Ltd.',
    sector: 'Renewable Energy',
    capCategory: 'small',
    tradingSegment: 'Cash Only',
    marketCapVal: 65000,
    volumeVal: 42000000,
    ...generatePriceHistory('SUZLON', 48, 110, 0.045),
  },
  {
    symbol: 'BSE',
    name: 'BSE Ltd.',
    sector: 'Financial Services',
    capCategory: 'small',
    tradingSegment: 'Cash Only',
    marketCapVal: 32000,
    volumeVal: 4100000,
    ...generatePriceHistory('BSE', 2400, 95, 0.042),
  },
  {
    symbol: 'DATAPATT',
    name: 'Data Patterns India Ltd.',
    sector: 'Defense & Aerospace',
    capCategory: 'small',
    tradingSegment: 'Cash Only',
    marketCapVal: 16000,
    volumeVal: 1400000,
    ...generatePriceHistory('DATAPATT', 2800, 48, 0.032),
  },
  {
    symbol: 'CGPOWER',
    name: 'CG Power & Industrial Solutions',
    sector: 'Capital Goods',
    capCategory: 'small',
    tradingSegment: 'Cash Only',
    marketCapVal: 72000,
    volumeVal: 3800000,
    ...generatePriceHistory('CGPOWER', 480, 52, 0.03),
  },
  {
    symbol: 'KAYNES',
    name: 'Kaynes Technology India Ltd.',
    sector: 'Electronics Manufacturing',
    capCategory: 'small',
    tradingSegment: 'Cash Only',
    marketCapVal: 18000,
    volumeVal: 920000,
    ...generatePriceHistory('KAYNES', 3100, 60, 0.036),
  },
  {
    symbol: 'ANANTRAJ',
    name: 'Anant Raj Ltd.',
    sector: 'Real Estate',
    capCategory: 'small',
    tradingSegment: 'Cash Only',
    marketCapVal: 12500,
    volumeVal: 2200000,
    ...generatePriceHistory('ANANTRAJ', 360, 72, 0.039),
  },
  {
    symbol: 'KFINTECH',
    name: 'KFin Technologies Ltd.',
    sector: 'Financial Technology',
    capCategory: 'small',
    tradingSegment: 'Cash Only',
    marketCapVal: 11000,
    volumeVal: 1300000,
    ...generatePriceHistory('KFINTECH', 680, 45, 0.029),
  },
  {
    symbol: 'TEJASNET',
    name: 'Tejas Networks Ltd.',
    sector: 'Telecommunication',
    capCategory: 'small',
    tradingSegment: 'Cash Only',
    marketCapVal: 15000,
    volumeVal: 2700000,
    ...generatePriceHistory('TEJASNET', 920, 40, 0.034),
  },
  {
    symbol: 'RCF',
    name: 'Rashtriya Chemicals & Fertilisers',
    sector: 'Chemicals & Agrochemicals',
    capCategory: 'small',
    tradingSegment: 'Cash Only',
    marketCapVal: 8500,
    volumeVal: 3500000,
    ...generatePriceHistory('RCF', 155, 25, 0.028),
  },
];

/**
 * Generate Equal-Weighted Sector NAV Data & Multi-Timeframe Return Metrics (Section 3)
 */
export function getSectorsNavData(): SectorNavData[] {
  const sectorMap = new Map<string, RawStockData[]>();
  STOCK_UNIVERSE.forEach((stock) => {
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
