import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { CapCategory, StockPick, StrategyDefinition, ScanProgress } from '../engine/types';
import { ALL_STRATEGIES, getStrategyById } from '../engine/strategies';
import { runParallelStockScan } from '../engine/scannerEngine';

export type SortOption =
  | 'rank'
  | 'price-desc'
  | 'price-asc'
  | 'change-desc'
  | 'change-asc'
  | 'name-asc'
  | 'upside-desc'
  | 'rs-desc';

export type ResultCapFilter = 'all' | 'large' | 'mid' | 'small';

const SESSION_STORAGE_PICKS_KEY = 'stock_selector_upstox_picks';

interface StrategyContextType {
  strategies: StrategyDefinition[];
  activeStrategyId: string;
  setActiveStrategyId: (id: string) => void;
  activeStrategy: StrategyDefinition;

  capCategory: CapCategory;
  setCapCategory: (cap: CapCategory) => void;

  picks: StockPick[];
  isScanning: boolean;
  progress: ScanProgress;
  lastUpdated: string | null;
  refetch: () => Promise<void>;
  runScan: (strategyId?: string, cap?: CapCategory, force?: boolean) => Promise<void>;

  searchQuery: string;
  setSearchQuery: (query: string) => void;

  signalFilter: 'all' | 'strong-buy' | 'buy' | 'hold';
  setSignalFilter: (filter: 'all' | 'strong-buy' | 'buy' | 'hold') => void;

  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;

  resultCapFilter: ResultCapFilter;
  setResultCapFilter: (filter: ResultCapFilter) => void;

  activeDataSource: string;
}

const StrategyContext = createContext<StrategyContextType | null>(null);

export function StrategyProvider({ children }: { children: ReactNode }) {
  const [strategies] = useState<StrategyDefinition[]>(ALL_STRATEGIES);
  const [activeStrategyId, setActiveStrategyIdState] = useState<string>(
    ALL_STRATEGIES[0].id // Swing Strategy is 1st
  );
  const [capCategory, setCapCategoryState] = useState<CapCategory>('all');
  const [picks, setPicks] = useState<StockPick[]>(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_PICKS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const age = Date.now() - (parsed.timestamp ?? 0);
        if (age < 2 * 60 * 1000 && Array.isArray(parsed.picks) && parsed.picks.length > 0) {
          return parsed.picks;
        }
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [progress, setProgress] = useState<ScanProgress>({
    scanned: 0,
    total: 0,
    currentSymbol: '',
    status: 'idle',
    percent: 0,
  });
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [signalFilter, setSignalFilter] = useState<'all' | 'strong-buy' | 'buy' | 'hold'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('rank');
  const [resultCapFilter, setResultCapFilter] = useState<ResultCapFilter>('all');
  const [activeDataSource] = useState<string>('Upstox');

  const activeStrategy = getStrategyById(activeStrategyId);

  const runScan = useCallback(
    async (strategyIdToUse?: string, capToUse?: CapCategory, force = false) => {
      const sid = strategyIdToUse || activeStrategyId;
      const targetCap = capToUse || capCategory;
      const currentStrategy = getStrategyById(sid);

      // Check session cache if not forced
      if (!force) {
        try {
          const raw = sessionStorage.getItem(`${SESSION_STORAGE_PICKS_KEY}_${sid}_${targetCap}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            const age = Date.now() - (parsed.timestamp ?? 0);
            if (age < 2 * 60 * 1000 && Array.isArray(parsed.picks) && parsed.picks.length > 0) {
              setPicks(parsed.picks);
              setLastUpdated(new Date(parsed.timestamp).toISOString());
              return;
            }
          }
        } catch {
          // ignore
        }
      }

      setIsScanning(true);
      try {
        const { picks: results } = await runParallelStockScan({
          strategy: currentStrategy,
          capCategory: targetCap,
          onProgress: (p) => {
            setProgress(p);
          },
        });

        setPicks(results);
        const now = new Date().toISOString();
        setLastUpdated(now);

        try {
          sessionStorage.setItem(
            `${SESSION_STORAGE_PICKS_KEY}_${sid}_${targetCap}`,
            JSON.stringify({ picks: results, timestamp: Date.now() })
          );
        } catch {
          // sessionStorage full or unavailable
        }
      } catch (err) {
        console.error('[StrategyContext] Scan error:', err);
      } finally {
        setIsScanning(false);
      }
    },
    [activeStrategyId, capCategory]
  );

  const refetch = useCallback(() => runScan(undefined, undefined, true), [runScan]);

  const prevScanKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${activeStrategyId}__${capCategory}`;
    if (prevScanKeyRef.current === key) return;
    prevScanKeyRef.current = key;
    runScan(activeStrategyId, capCategory);
  }, [activeStrategyId, capCategory, runScan]);

  const setActiveStrategyId = (id: string) => {
    setActiveStrategyIdState(id);
  };

  const setCapCategory = (cap: CapCategory) => {
    setCapCategoryState(cap);
  };

  return (
    <StrategyContext.Provider
      value={{
        strategies,
        activeStrategyId,
        setActiveStrategyId,
        activeStrategy,
        capCategory,
        setCapCategory,
        picks,
        isScanning,
        progress,
        lastUpdated,
        refetch,
        runScan,
        searchQuery,
        setSearchQuery,
        signalFilter,
        setSignalFilter,
        sortBy,
        setSortBy,
        resultCapFilter,
        setResultCapFilter,
        activeDataSource,
      }}
    >
      {children}
    </StrategyContext.Provider>
  );
}

export function useStrategy() {
  const context = useContext(StrategyContext);
  if (!context) {
    throw new Error('useStrategy must be used within StrategyProvider');
  }
  return context;
}
