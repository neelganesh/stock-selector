import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { CapCategory, StockPick, StrategyDefinition, ScanProgress } from '../engine/types';
import { ALL_STRATEGIES, getStrategyById } from '../engine/strategies';
import { runParallelStockScan } from '../engine/scannerEngine';

export type DataSourceType = 'yfinance';

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

const SESSION_STORAGE_PICKS_KEY = 'stock_selector_picks';

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
  runScan: (strategyId?: string, cap?: CapCategory) => Promise<void>;
  
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  signalFilter: 'all' | 'strong-buy' | 'buy' | 'hold';
  setSignalFilter: (filter: 'all' | 'strong-buy' | 'buy' | 'hold') => void;

  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;

  resultCapFilter: ResultCapFilter;
  setResultCapFilter: (filter: ResultCapFilter) => void;

  activeDataSource: DataSourceType;
  setActiveDataSource: (source: DataSourceType) => void;
  customScripList: string[];
  setCustomScripList: (scrips: string[]) => void;
}

const StrategyContext = createContext<StrategyContextType | null>(null);

export function StrategyProvider({ children }: { children: ReactNode }) {
  const [strategies] = useState<StrategyDefinition[]>(ALL_STRATEGIES);
  const [activeStrategyId, setActiveStrategyIdState] = useState<string>(
    ALL_STRATEGIES[0].id // Zerodha Swing Strategy is 1st
  );
  const [capCategory, setCapCategoryState] = useState<CapCategory>('all');
  const [picks, setPicks] = useState<StockPick[]>(() => {
    // Hydrate picks from sessionStorage for instant refresh within session
    // Checks 2-minute TTL — expired entries are ignored
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_PICKS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const age = Date.now() - (parsed.timestamp ?? 0);
        const ttl = parsed.ttl ?? 2 * 60 * 1000;
        if (age < ttl && Array.isArray(parsed.picks) && parsed.picks.length > 0) {
          return parsed.picks;
        }
      }
    } catch {
      // ignore corrupt data
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

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [signalFilter, setSignalFilter] = useState<'all' | 'strong-buy' | 'buy' | 'hold'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('rank');
  const [resultCapFilter, setResultCapFilter] = useState<ResultCapFilter>('all');

  const [activeDataSource, setActiveDataSource] = useState<DataSourceType>('yfinance');
  const [customScripList, setCustomScripList] = useState<string[]>([]);


  const activeStrategy = getStrategyById(activeStrategyId);

  const runScan = useCallback(
    async (strategyIdToUse?: string, capToUse?: CapCategory) => {
      const currentStrategy = getStrategyById(strategyIdToUse || activeStrategyId);
      const targetCap = capToUse || capCategory;

      setIsScanning(true);

      try {
        const { picks: results, activeDataSource: source } = await runParallelStockScan({
          strategy: currentStrategy,
          capCategory: targetCap,
          customScrips: customScripList,
          onProgress: (p) => {
            setProgress(p);
          },
          onDataSourceDetermined: (source) => {
            setActiveDataSource(source);
          },
        });
        setPicks(results);
        setActiveDataSource(source);
      } catch (err) {
        console.error('Scan error:', err);
      } finally {
        setIsScanning(false);
      }
    },
    [activeStrategyId, capCategory, customScripList]
  );

  // Persist picks to sessionStorage whenever they change (enables instant refresh)
  // Uses 2-minute TTL so cached signals expire and refresh on back-navigation
  useEffect(() => {
    try {
      if (picks.length > 0) {
        const cacheEntry = {
          picks,
          timestamp: Date.now(),
          ttl: 2 * 60 * 1000, // 2 minutes in milliseconds
        };
        sessionStorage.setItem(SESSION_STORAGE_PICKS_KEY, JSON.stringify(cacheEntry));
      }
    } catch {
      // sessionStorage may be unavailable
    }
  }, [picks]);

  // Prefetch-on-idle: after initial signals load, prefetch next page data
  // using requestIdleCallback (with setTimeout fallback)
  useEffect(() => {
    if (picks.length === 0 || isScanning) return;

    let idleHandle: number | undefined;

    const schedulePrefetch = () => {
      const schedule =
        typeof requestIdleCallback !== 'undefined'
          ? (cb: () => void) => requestIdleCallback(cb, { timeout: 5000 }) as unknown as number
          : (cb: () => void) => window.setTimeout(cb, 1000);

      idleHandle = schedule(() => {
        try {
          // Pre-warm the next page of data by triggering a lightweight scan
          // in the background. This ensures subsequent navigation is instant.
          const nextPagePrefetch = async () => {
            // Only prefetch if not already scanning
            if (!document.hidden) {
              runScan(activeStrategyId, capCategory).catch(() => {
                // Prefetch is best-effort; ignore errors
              });
            }
          };
          nextPagePrefetch();
        } catch {
          // ignore prefetch errors
        }
      });
    };

    // Wait a brief moment after initial load before prefetching
    const delayHandle = window.setTimeout(() => {
      schedulePrefetch();
    }, 3000);

    return () => {
      clearTimeout(delayHandle);
      if (idleHandle) {
        if (typeof cancelIdleCallback !== 'undefined') {
          cancelIdleCallback(idleHandle);
        } else {
          clearTimeout(idleHandle);
        }
      }
    };
  }, [picks.length, isScanning, activeStrategyId, capCategory]);

  // Trigger initial scan when component mounts or strategy/cap changes
  useEffect(() => {
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
        setActiveDataSource,
        customScripList,
        setCustomScripList,
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
