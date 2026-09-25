import type { StockPick, StrategyDefinition, CapCategory, ScanProgress, RawStockData } from './types';
import { getUniverse } from '../services/universeService';

export interface ScanOptions {
  strategy: StrategyDefinition;
  capCategory: CapCategory;
  customScrips?: string[];
  onProgress?: (progress: ScanProgress) => void;
  onDataSourceDetermined?: (source: 'Upstox') => void;
  chunkSize?: number;
  delayBetweenChunksMs?: number;
}

/**
 * Parallel stock scanner using real Upstox candle data via /api/candles.
 *
 * NO MOCKS / NO HARDCODED DATA:
 * - Scans real stocks from Supabase universe.
 * - Fetches real Upstox daily candles.
 * - Skips any instrument without valid live data cleanly.
 * - Provides live progress reporting to the frontend during page load scan.
 */
export async function runParallelStockScan(options: ScanOptions): Promise<{
  picks: StockPick[];
  activeDataSource: 'Upstox';
}> {
  const {
    strategy,
    capCategory,
    onProgress,
    onDataSourceDetermined,
    chunkSize = 6,
    delayBetweenChunksMs = 30,
  } = options;

  onDataSourceDetermined?.('Upstox');

  // Load real universe from DB (Supabase) via universeService
  const allStocks = await getUniverse(capCategory);
  const targetUniverse = allStocks.filter((s) => !!s.instrumentKey);

  const total = targetUniverse.length;
  let completed = 0;
  const picks: StockPick[] = [];

  onProgress?.({
    scanned: 0,
    total,
    currentSymbol: 'Connecting to Upstox...',
    status: 'scanning',
    percent: 0,
  });

  // Process stocks in parallel chunks of chunkSize
  for (let i = 0; i < total; i += chunkSize) {
    const chunk = targetUniverse.slice(i, i + chunkSize);
    const keys = chunk.map((s) => s.instrumentKey).filter(Boolean) as string[];

    try {
      const res = await fetch(`/api/candles?keys=${encodeURIComponent(keys.join(','))}`);
      if (res.ok) {
        const json = await res.json();
        const results = json.results || {};

        for (const stock of chunk) {
          const key = stock.instrumentKey;
          if (!key || !results[key] || results[key].error) continue;

          const candleData = results[key];
          if (!candleData.prices || candleData.prices.length < 50) continue;

          const stockToScan: RawStockData = {
            ...stock,
            prices: candleData.prices,
            volumeHistory: candleData.volumeHistory,
            sectorNavHistory: candleData.sectorNavHistory,
            dataSource: 'Upstox',
          };

          const pick = strategy.execute(stockToScan);
          if (pick) {
            pick.dataSource = 'Upstox';
            picks.push(pick);
          }
        }
      }
    } catch (err) {
      console.error('[scannerEngine] Chunk scan error:', err);
    }

    completed += chunk.length;
    const lastStockInChunk = chunk[chunk.length - 1];

    onProgress?.({
      scanned: completed,
      total,
      currentSymbol: lastStockInChunk ? lastStockInChunk.symbol : '',
      status: 'scanning',
      percent: Math.min(100, Math.round((completed / total) * 100)),
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
    activeDataSource: 'Upstox',
  };
}
