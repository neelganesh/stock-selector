import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { CapCategory, StockPick, StrategyDefinition } from '../engine/types';
import { ALL_STRATEGIES, getStrategyById } from '../engine/strategies';

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

interface StrategyContextType {
  strategies: StrategyDefinition[];
  activeStrategyId: string;
  setActiveStrategyId: (id: string) => void;
  activeStrategy: StrategyDefinition;

  capCategory: CapCategory;
  setCapCategory: (cap: CapCategory) => void;

  picks: StockPick[];
  isScanning: boolean;
  lastUpdated: string | null;
  refetch: () => Promise<void>;

  searchQuery: string;
  setSearchQuery: (query: string) => void;

  signalFilter: 'all' | 'strong-buy' | 'buy' | 'hold';
  setSignalFilter: (filter: 'all' | 'strong-buy' | 'buy' | 'hold') => void;

  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;

  resultCapFilter: ResultCapFilter;
  setResultCapFilter: (filter: ResultCapFilter) => void;
}

const StrategyContext = createContext<StrategyContextType | null>(null);

export function StrategyProvider({ children }: { children: ReactNode }) {
  const [strategies] = useState<StrategyDefinition[]>(ALL_STRATEGIES);
  const [activeStrategyId, setActiveStrategyIdState] = useState<string>(
    ALL_STRATEGIES[0].id // Swing Strategy is 1st
  );
  const [capCategory, setCapCategoryState] = useState<CapCategory>('all');
  const [picks, setPicks] = useState<StockPick[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [signalFilter, setSignalFilter] = useState<'all' | 'strong-buy' | 'buy' | 'hold'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('rank');
  const [resultCapFilter, setResultCapFilter] = useState<ResultCapFilter>('all');

  const activeStrategy = getStrategyById(activeStrategyId);

  /**
   * The scan runs server-side (/api/scan). The browser only reads results;
   * `force` bypasses the server's 15-minute cache (refetch button).
   */
  const runScan = useCallback(
    async (strategyIdToUse?: string, capToUse?: CapCategory, force = false) => {
      const sid = strategyIdToUse || activeStrategyId;
      const targetCap = capToUse || capCategory;

      setIsScanning(true);
      try {
        const params = new URLSearchParams({ strategy: sid, cap: targetCap });
        if (force) params.set('force', '1');
        const res = await fetch(`/api/scan?${params}`);
        if (!res.ok) throw new Error(`Scan API ${res.status}`);
        const json = await res.json();
        setPicks(json.picks ?? []);
        setLastUpdated(json.updatedAt ?? null);
      } catch (err) {
        console.error('Scan error:', err);
      } finally {
        setIsScanning(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeStrategyId, capCategory]
  );

  const refetch = useCallback(() => runScan(undefined, undefined, true), [runScan]);

  // Trigger scan on mount and when strategy/cap changes.
  const prevScanKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${activeStrategyId}__${capCategory}`;
    if (prevScanKeyRef.current === key) return; // no change — skip
    prevScanKeyRef.current = key;
    runScan(activeStrategyId, capCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStrategyId, capCategory]); // runScan intentionally omitted — stable enough

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
        lastUpdated,
        refetch,
        searchQuery,
        setSearchQuery,
        signalFilter,
        setSignalFilter,
        sortBy,
        setSortBy,
        resultCapFilter,
        setResultCapFilter,
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
