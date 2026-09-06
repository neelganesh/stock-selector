import type { StockPick, StrategyDefinition, CapCategory, ScanProgress, RawStockData } from './types';
import { getUniverse } from '../services/universeService';
import { fetchYFinanceData, clearYFinanceCache } from '../services/yfinanceService';

export interface ScanOptions {
  strategy: StrategyDefinition;
  capCategory: CapCategory;
  customScrips?: string[];
  onProgress?: (progress: ScanProgress) => void;
  onDataSourceDetermined?: (source: 'yfinance') => void;
  chunkSize?: number;
  delayBetweenChunksMs?: number;
}

/**
 * Stock Scanning Engine using yfinance for historical data.
 * 
 * Note: Kite Publisher mode is used for ORDER PLACEMENT only (see kitePublisher.ts).
 * Historical price data comes from yfinance.
 */
export async function runParallelStockScan(options: ScanOptions): Promise<{
  picks: StockPick[];
  activeDataSource: 'yfinance';
}> {
  const {
    strategy,
    capCategory,
    onProgress,
    onDataSourceDetermined,
    chunkSize = 6,
    delayBetweenChunksMs = 40,
  } = options;

  const determinedDataSource: 'yfinance' = 'yfinance';
  onDataSourceDetermined?.(determinedDataSource);

  // Clear memory cache so fresh live values are always refetched
  clearYFinanceCache();

  // Load universe from DB (Supabase) via universeService. Falls back to seed list.
  const customSet = options.customScrips && options.customScrips.length > 0
    ? new Set(options.customScrips.map((s) => s.toUpperCase()))
    : null;

  const dbUniverse = await getUniverse('all');
  const targetUniverse = dbUniverse.filter((stock) => {
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

          // Fetch / use yfinance data
          const yfData = await fetchYFinanceData(stock.symbol, stock.prices[0]);
          stockDataToScan.prices = yfData.prices;
          stockDataToScan.volumeHistory = yfData.volumeHistory;
          stockDataToScan.sectorNavHistory = yfData.sectorNavHistory;
          stockDataToScan.dataSource = 'yfinance';

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
