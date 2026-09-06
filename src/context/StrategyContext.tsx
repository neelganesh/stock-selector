import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { CapCategory, StockPick, StrategyDefinition, ScanProgress } from '../engine/types';
import { ALL_STRATEGIES, getStrategyById } from '../engine/strategies';
import { runParallelStockScan } from '../engine/scannerEngine';
import { checkAndExtractRequestToken, getKiteCredentials } from '../services/kiteService';

export type DataSourceType = 'Zerodha Kite API (Live)' | 'yfinance (Fallback)';

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
  
  isZerodhaModalOpen: boolean;
  setIsZerodhaModalOpen: (open: boolean) => void;

  customScripList: string[];
  setCustomScripList: (scrips: string[]) => void;

  isPaperOnly: boolean;
  setIsPaperOnly: (v: boolean) => void;
}

const StrategyContext = createContext<StrategyContextType | null>(null);

export function StrategyProvider({ children }: { children: ReactNode }) {
  const [strategies] = useState<StrategyDefinition[]>(ALL_STRATEGIES);
  const [activeStrategyId, setActiveStrategyIdState] = useState<string>(
    ALL_STRATEGIES[0].id // Zerodha Swing Strategy is 1st
  );
  const [capCategory, setCapCategoryState] = useState<CapCategory>('all');
  const [picks, setPicks] = useState<StockPick[]>([]);
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

  const [activeDataSource, setActiveDataSource] = useState<DataSourceType>('yfinance (Fallback)');
  const [isZerodhaModalOpen, setIsZerodhaModalOpen] = useState<boolean>(false);
  const [customScripList, setCustomScripList] = useState<string[]>([]);
  const [isPaperOnly, setIsPaperOnlyState] = useState<boolean>(true);

  const setIsPaperOnly = (val: boolean) => setIsPaperOnlyState(val);

  const activeStrategy = getStrategyById(activeStrategyId);

  // Auto-detect Zerodha OAuth redirect token on mount
  useEffect(() => {
    checkAndExtractRequestToken();
    const creds = getKiteCredentials();
    if (creds.apiKey && (creds.accessToken || creds.requestToken) && creds.hasHistoricalAccess) {
      setActiveDataSource('Zerodha Kite API (Live)');
    } else {
      setActiveDataSource('yfinance (Fallback)');
    }
  }, []);

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
        isZerodhaModalOpen,
        setIsZerodhaModalOpen,
        customScripList,
        setCustomScripList,
        isPaperOnly,
        setIsPaperOnly,
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
