import type { StockPick, StrategyDefinition, CapCategory, ScanProgress, RawStockData } from './types';
import { STOCK_UNIVERSE } from './universe';
import { getKiteCredentials, fetchKiteCandles } from '../services/kiteService';
import { fetchYFinanceData, clearYFinanceCache } from '../services/yfinanceService';

export interface ScanOptions {
  strategy: StrategyDefinition;
  capCategory: CapCategory;
  customScrips?: string[];
  onProgress?: (progress: ScanProgress) => void;
  onDataSourceDetermined?: (source: 'Zerodha Kite API (Live)' | 'yfinance (Fallback)') => void;
  chunkSize?: number;
  delayBetweenChunksMs?: number;
}

/**
 * Robust Parallel Stock Scanning Engine
 * - Iterates over Large, Mid, and Small Cap universe
 * - Evaluates Zerodha Kite API live historical candles if authenticated
 * - Seamlessly falls back to yfinance (Yahoo Finance) if Zerodha Key/Historical subscription is missing or returns 403
 * - Provides real-time progress & data source reporting
 */
export async function runParallelStockScan(options: ScanOptions): Promise<{
  picks: StockPick[];
  activeDataSource: 'Zerodha Kite API (Live)' | 'yfinance (Fallback)';
}> {
  const {
    strategy,
    capCategory,
    onProgress,
    onDataSourceDetermined,
    chunkSize = 6,
    delayBetweenChunksMs = 40,
  } = options;

  const creds = getKiteCredentials();
  const isKiteEligible = Boolean(creds.apiKey && (creds.accessToken || creds.requestToken) && creds.hasHistoricalAccess);
  
  let determinedDataSource: 'Zerodha Kite API (Live)' | 'yfinance (Fallback)' = isKiteEligible
    ? 'Zerodha Kite API (Live)'
    : 'yfinance (Fallback)';

  onDataSourceDetermined?.(determinedDataSource);

  // Clear memory cache so fresh live values are always refetched
  clearYFinanceCache();

  // Filter universe by requested Cap Category or Custom Scrips
  const customSet = options.customScrips && options.customScrips.length > 0
    ? new Set(options.customScrips.map((s) => s.toUpperCase()))
    : null;

  const targetUniverse = STOCK_UNIVERSE.filter((stock) => {
    if (customSet) {
      return customSet.has(stock.symbol.toUpperCase());
    }
    if (capCategory === 'all') return true;
    return stock.capCategory === capCategory;
  });

  const total = targetUniverse.length;
  let completed = 0;
  const picks: StockPick[] = [];

  // Notify initial state
  onProgress?.({
    scanned: 0,
    total,
    currentSymbol: 'Initializing Scanner...',
    status: 'scanning',
    percent: 0,
  });

  // Process stocks in parallel chunks
  for (let i = 0; i < total; i += chunkSize) {
    const chunk = targetUniverse.slice(i, i + chunkSize);

    // Parallel evaluation of the current chunk
    const chunkResults = await Promise.all(
      chunk.map(async (stock) => {
        try {
          let stockDataToScan: RawStockData = { ...stock };

          if (determinedDataSource === 'Zerodha Kite API (Live)') {
            const kiteResult = await fetchKiteCandles(stock.symbol, creds);
            if (kiteResult) {
              stockDataToScan.prices = kiteResult.prices;
              stockDataToScan.volumeHistory = kiteResult.volumeHistory;
              stockDataToScan.dataSource = kiteResult.dataSource;
            } else {
              // Kite failed or no historical permission -> switch session fallback to yfinance
              determinedDataSource = 'yfinance (Fallback)';
              onDataSourceDetermined?.(determinedDataSource);
              const yfData = await fetchYFinanceData(stock.symbol, stock.prices[0]);
              stockDataToScan.prices = yfData.prices;
              stockDataToScan.volumeHistory = yfData.volumeHistory;
              stockDataToScan.sectorNavHistory = yfData.sectorNavHistory;
              stockDataToScan.dataSource = 'yfinance (Fallback)';
            }
          } else {
            // Fetch / use yfinance data
            const yfData = await fetchYFinanceData(stock.symbol, stock.prices[0]);
            stockDataToScan.prices = yfData.prices;
            stockDataToScan.volumeHistory = yfData.volumeHistory;
            stockDataToScan.sectorNavHistory = yfData.sectorNavHistory;
            stockDataToScan.dataSource = 'yfinance (Fallback)';
          }

          // Small micro-task tick for UI smoothness
          await new Promise((resolve) => setTimeout(resolve, 15));
          const pick = strategy.execute(stockDataToScan);
          if (pick) {
            pick.dataSource = stockDataToScan.dataSource;
          }
          return pick;
        } catch (err) {
          console.error(`Error scanning ${stock.symbol}:`, err);
          return null;
        }
      })
    );

    // Collect valid picks
    for (const result of chunkResults) {
      if (result) {
        picks.push(result);
      }
    }

    completed += chunk.length;
    const lastStockInChunk = chunk[chunk.length - 1];

    onProgress?.({
      scanned: completed,
      total,
      currentSymbol: lastStockInChunk ? lastStockInChunk.symbol : '',
      status: 'scanning',
      percent: Math.round((completed / total) * 100),
    });

    if (i + chunkSize < total && delayBetweenChunksMs > 0) {
      await new Promise((res) => setTimeout(res, delayBetweenChunksMs));
    }
  }

  // Sort picks: Strong Buy first, then high Relative Strength
  picks.sort((a, b) => {
    const order: Record<string, number> = { 'strong-buy': 4, buy: 3, hold: 2, sell: 1, 'strong-sell': 0 };
    const diff = (order[b.signal] ?? 0) - (order[a.signal] ?? 0);
    if (diff !== 0) return diff;
    return (
      (b.signalDetails.indicators.relativeStrengthVsSector || 0) -
      (a.signalDetails.indicators.relativeStrengthVsSector || 0)
    );
  });

  onProgress?.({
    scanned: total,
    total,
    currentSymbol: 'Completed',
    status: 'idle',
    percent: 100,
  });

  return {
    picks,
    activeDataSource: determinedDataSource,
  };
}
