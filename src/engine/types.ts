import type { RenkoResult } from './indicators';

export type CapCategory = 'large' | 'mid' | 'small' | 'all';

export type SignalType = 'strong-buy' | 'buy' | 'hold' | 'sell' | 'strong-sell';

export type TradingSegment = 'F&O Segment' | 'Cash Only';

export interface StockSignal {
  entry: number;
  stopLoss: number;
  target1: number;
  target2?: number;
  rationale: string;
  indicators: {
    rsi: number;
    ema20: number;
    ema50: number;
    ema200: number;
    supertrend: 'bullish' | 'bearish';
    volumeRatio: number;
    relativeStrengthVsSector: number; // Wagner & Pedicelli metric (Versus NAV)
    renko: RenkoResult; // Renko price-only breakout confirmation
    atr: number;
  };
}

export interface StockPick {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  capCategory: CapCategory;
  tradingSegment: TradingSegment;
  currentPrice: number;
  change: number;
  changePercent: number;
  signal: SignalType;
  signalDetails: StockSignal;
  volume: string;
  marketCap: string;
  lastUpdated: Date;
  dataSource?: string;
}

export interface RawStockData {
  symbol: string;
  name: string;
  sector: string;
  industry?: string | null;
  capCategory: CapCategory;
  tradingSegment?: TradingSegment;
  marketCapVal: number; // in Cr. Optional — scanner fetches live volume at scan time.
  volumeVal: number;
  prices: number[]; // Daily close prices over last 200 days
  volumeHistory: number[];
  sectorNavHistory: number[]; // Equal-Weighted Sector NAV over same period
  dataSource?: string;
}

export interface SectorNavData {
  id: string;
  name: string;
  universeType: 'NSE Sectoral' | 'Tijori Subsector (TJI)';
  stockCount: number;
  returns: {
    d1: number;
    w1: number;
    m1: number;
    m3: number;
    m6: number;
  };
  emaAlignment: 'Bullish Alignment (20 > 50 > 200)' | 'Mixed Trend' | 'Bearish';
  topOutperformingConstituents: Array<{
    symbol: string;
    name: string;
    versusNav: number;
    price: number;
  }>;
}

export interface ScanProgress {
  scanned: number;
  total: number;
  currentSymbol: string;
  status: 'idle' | 'scanning' | 'completed' | 'error';
  percent: number;
}

export interface StrategyDefinition {
  id: string;
  name: string;
  shortName: string;
  description: string;
  category: string;
  rules: string[];
  execute: (stock: RawStockData) => StockPick | null;
}
