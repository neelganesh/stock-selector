import { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { StrategyProvider, useStrategy } from './context/StrategyContext';
import { Sidebar } from './components/Sidebar';
import { MobileSidebarDrawer } from './components/MobileSidebarDrawer';
import { MobileBodyClass } from './components/MobileBodyClass';
import StockCard from './components/StockCard';
import { ExpandableCard } from './components/ExpandableCard';
import { ToastProvider } from './components/ToastProvider';
import { useToast } from './components/useToast';
import { Pagination } from './components/Pagination';
import { InfoTooltip } from './components/InfoTooltip';
import { Icon } from './components/Icon';
import { AnimatedNumber } from './components/AnimatedNumber';
import { useTheme } from './hooks/useTheme';

const RESULTS_PER_PAGE = 12;

class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { hasError: boolean; error: Error | null }> {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--ground)', padding: '20px', color: 'var(--text-primary)' }}>
          <div style={{ textAlign: 'center', maxWidth: 500 }}>
            <h2 style={{ color: 'var(--hazard-red)', marginBottom: '16px' }}>Application Error</h2>
            <pre style={{ textAlign: 'left', background: 'var(--elevated-2)', padding: '16px', borderRadius: '8px', overflow: 'auto', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
              {this.state.error?.message}
{this.state.error?.stack}
            </pre>
            <button onClick={() => window.location.reload()} style={{ marginTop: '16px', padding: '10px 20px', background: 'var(--accent-brand)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function DashboardContent() {
  const {
    activeStrategy,
    picks,
    isScanning,
    progress,
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
  } = useStrategy();

  const toast = useToast();
  const prefersReducedMotion = useReducedMotion();

  const [currentPage, setCurrentPage] = useState(1);
  const [isRefetching, setIsRefetching] = useState(false);

  // Reset to first page whenever the result set or sort changes shape
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, signalFilter, resultCapFilter, sortBy, picks.length]);

  const handleRefetch = async () => {
    setIsRefetching(true);
    try {
      await refetch();
      toast.success('Data refreshed');
    } catch {
      toast.error('Refetch failed');
    } finally {
      setIsRefetching(false);
    }
  };

  // Filter and sort picks based on search query, signal filter, cap category & sort selection
  const processedPicks = [...picks]
    .filter((stock) => {
      const matchesSearch =
        stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stock.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stock.sector.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSignal =
        signalFilter === 'all' ? true : stock.signal === signalFilter;

      const matchesCap =
        resultCapFilter === 'all' ? true : stock.capCategory === resultCapFilter;

      return matchesSearch && matchesSignal && matchesCap;
    })
    .sort((a, b) => {
      if (sortBy === 'price-desc') return b.currentPrice - a.currentPrice;
      if (sortBy === 'price-asc') return a.currentPrice - b.currentPrice;
      if (sortBy === 'change-desc') return b.changePercent - a.changePercent;
      if (sortBy === 'change-asc') return a.changePercent - b.changePercent;
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      if (sortBy === 'upside-desc') {
        if (!a.signalDetails || !b.signalDetails) return 0;
        const upsideA = ((a.signalDetails.target1 - a.currentPrice) / a.currentPrice) * 100;
        const upsideB = ((b.signalDetails.target1 - b.currentPrice) / b.currentPrice) * 100;
        return upsideB - upsideA;
      }
      if (sortBy === 'rs-desc') {
        if (!a.signalDetails || !b.signalDetails) return 0;
        return (
          b.signalDetails.indicators.relativeStrengthVsSector -
          a.signalDetails.indicators.relativeStrengthVsSector
        );
      }
      return 0;
    });

  const strongBuyCount = picks.filter((p) => p.signal === 'strong-buy').length;
  const buyCount = picks.filter((p) => p.signal === 'buy').length;

  const totalPages = Math.max(1, Math.ceil(processedPicks.length / RESULTS_PER_PAGE));
  const pagedPicks = processedPicks.slice((currentPage - 1) * RESULTS_PER_PAGE, currentPage * RESULTS_PER_PAGE);

  const avgUpside = picks.length
    ? (
        picks.reduce(
          (acc, p) =>
            acc +
            (p.signalDetails ? ((p.signalDetails.target1 - p.currentPrice) / p.currentPrice) * 100 : 0),
          0
        ) / picks.length
      ).toFixed(1)
    : '0';

  const lastUpdatedLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="flex flex-col min-h-screen selection:bg-slate-200 text-slate-800" style={{ color: 'var(--text-primary)', backgroundColor: 'var(--ground)' }}>
      {/* ===== TOP BAR ===== */}
      <header
        className="relative"
        style={{
          backgroundColor: 'var(--ground)',
          borderBottomColor: 'var(--border-default)',
        }}
      >
        <div className="flex items-center h-12 pl-[60px] pr-3 gap-3 lg:pl-6">
          {/* Brand — icon-only on mobile, full brand on desktop */}
          <div className="flex items-center shrink-0" style={{ gap: '0.5rem' }}>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--accent-brand)' }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.25}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: '#fff' }}
              >
                <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="hidden lg:block font-semibold" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
              Quant Vision
            </span>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right cluster: data status + refetch */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5">
              <span className="w-2 h-2 rounded-full shrink-0 bg-slate-300" />
              <span className="text-[11px] font-medium whitespace-nowrap hidden sm:block" style={{ color: 'var(--text-secondary)' }}>
                Upstox
              </span>
              {lastUpdatedLabel && (
                <span className="text-[11px] whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>
                  · {lastUpdatedLabel}
                </span>
              )}
            </div>

            {/* Refetch button — forces a fresh server-side scan */}
            <button
              onClick={handleRefetch}
              disabled={isRefetching}
              className="flex items-center gap-1.5 font-semibold rounded-lg cursor-pointer transition-all whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: 'var(--accent-brand)',
                color: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                padding: 'clamp(0.25rem, 0.6cqi, 0.4rem) clamp(0.5rem, 1.2cqi, 0.65rem)',
                fontSize: 'var(--topbar-text)',
              }}
              aria-label="Refetch data"
            >
              <svg
                className={isRefetching ? 'animate-spin' : undefined}
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">Refetch</span>
            </button>
          </div>
        </div>

          {/* Scan progress — hairline along the bar's bottom edge. */}
          <AnimatePresence>
            {isScanning && (
              <motion.div
                className="absolute left-0 bottom-0 h-[2px] pointer-events-none"
                style={{ backgroundColor: 'var(--accent-brand)' }}
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: `${progress.percent}%`, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ width: { duration: 0.35, ease: [0.16, 1, 0.3, 1] }, opacity: { duration: 0.2 } }}
              />
            )}
          </AnimatePresence>
        </header>

      <div className="kite-body">
        {/* Left pane — sidebar */}
        <MobileSidebarDrawer>
          <Sidebar activeTab="signals" />
        </MobileSidebarDrawer>

        {/* Main pane */}
        <main className="kite-main">
            {/* Heading row */}
            <div className="flex flex-col gap-1 mb-6">
              <h1 className="hidden lg:block text-[13px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {activeStrategy.name}
              </h1>
              <h1 className="lg:hidden text-[22px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {activeStrategy.name}
              </h1>
              <p className="text-[13px] flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                <span>Swing picks, screened across the active market cap scope.</span>
                <InfoTooltip
                  label="About this strategy"
                  content={activeStrategy.description}
                  side="bottom"
                  size="md"
                />
              </p>
            </div>

            {/* Metrics Overview Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([
                { label: 'Qualified Picks', value: picks.length, color: 'var(--text-primary)', suffix: '' },
                { label: 'Strong Buy', value: strongBuyCount, color: 'var(--success-green)', suffix: '' },
                { label: 'Buy Signals', value: buyCount, color: 'var(--accent-blue)', suffix: '' },
                { label: 'Avg Target 1 Upside', value: Number(avgUpside), color: 'var(--success-green)', suffix: '%', prefix: '+' },
              ] as const).map((m, i) => (
                <motion.div
                  key={m.label}
                  className="kite-metric"
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(i * 0.05, 0.2), ease: [0.16, 1, 0.3, 1] }}
                >
                  <p className="kite-metric-label">{m.label}</p>
                  <p className="kite-metric-value" style={{ color: m.color }}>
                    {'prefix' in m ? m.prefix : ''}
                    <AnimatedNumber
                      value={m.value}
                      format={(v) => (m.suffix === '%' ? v.toFixed(1) : Math.round(v).toString())}
                      duration={0.7}
                    />
                    {m.suffix}
                  </p>
                  <span className="kite-metric-tick" style={{ backgroundColor: m.color }} />
                </motion.div>
              ))}
            </div>

            {/* Strategy Rules Accordion Card */}
            <div className="mt-3">
              <ExpandableCard
                title="Strategy Criteria & Rules"
                defaultOpen={false}
                icon={
                  <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                badge={
                  <span className="text-[11px] font-medium tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                    {activeStrategy.rules.length} rules
                  </span>
                }
              >
                <div className="flex items-center gap-3 pb-3 mb-4 border-b border-[color:var(--border-subtle)]">
                  <span className="text-[11px] font-semibold text-[color:var(--accent-brand)] bg-[color:var(--accent-brand)]/10 px-2.5 py-1 rounded-full border border-[color:var(--accent-brand)]/20">
                    {activeStrategy.shortName}
                  </span>
                  {activeStrategy.description && (
                    <span className="text-[11px] text-[color:var(--text-secondary)] leading-snug flex-1">
                      {activeStrategy.description}
                    </span>
                  )}
                </div>

                <ul className="flex flex-col gap-2">
                  {activeStrategy.rules.map((rule, idx) => {
                    // Categorize rules: first is Filter, last is Risk, middle are Entry
                    const isFirst = idx === 0;
                    const isLast = idx === activeStrategy.rules.length - 1;
                    const ruleCategory = isFirst ? 'Filter' : isLast ? 'Risk' : 'Entry';
                    const chipClass =
                      ruleCategory === 'Filter'
                        ? 'bg-[color:var(--elevated-1)] text-[color:var(--text-tertiary)] border-[color:var(--border-subtle)]'
                        : ruleCategory === 'Risk'
                        ? 'bg-[color:var(--hazard-red-bg)] text-[color:var(--hazard-red)] border-[color:var(--hazard-red)]/30'
                        : 'bg-[color:var(--accent-blue-bg)] text-[color:var(--accent-blue)] border-[color:var(--accent-blue)]/30';
                    const numClass =
                      ruleCategory === 'Filter'
                        ? 'bg-[color:var(--elevated-1)] text-[color:var(--text-tertiary)]'
                        : ruleCategory === 'Risk'
                        ? 'bg-[color:var(--hazard-red-bg)] text-[color:var(--hazard-red)]'
                        : 'bg-[color:var(--accent-blue-bg)] text-[color:var(--accent-blue)]';

                    return (
                      <li key={idx} className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-[color:var(--elevated-1)] transition-colors">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 mt-0.5 uppercase tracking-wide ${chipClass}`}>
                          {ruleCategory}
                        </span>
                        <span className={`w-5 h-5 rounded-full font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5 ${numClass}`}>
                          {idx + 1}
                        </span>
                        <span className="text-sm leading-snug text-[color:var(--text-secondary)] flex-1">{rule}</span>
                      </li>
                    );
                  })}
                </ul>
              </ExpandableCard>
            </div>

            {/* Filters & Search Control Bar */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pt-4 mt-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 text-[12px]">
                  <span className="px-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Refine cap:</span>
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'large', label: 'Large Cap' },
                      { id: 'mid', label: 'Mid Cap' },
                      { id: 'small', label: 'Small Cap' },
                    ] as const
                  ).map((capItem) => {
                    const isActive = resultCapFilter === capItem.id;
                    return (
                      <button
                        key={capItem.id}
                        onClick={() => setResultCapFilter(capItem.id)}
                        className="px-2.5 py-1 font-medium transition-colors cursor-pointer"
                        style={{
                          color: isActive ? 'var(--accent-brand)' : 'var(--text-secondary)',
                          borderBottom: isActive ? '2px solid var(--accent-brand)' : '2px solid transparent',
                          borderRadius: 0,
                        }}
                      >
                        {capItem.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1 text-[12px]">
                  <span className="px-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Signal:</span>
                  {(['all', 'strong-buy', 'buy', 'hold'] as const).map((filter) => {
                    const isActive = signalFilter === filter;
                    return (
                      <button
                        key={filter}
                        onClick={() => setSignalFilter(filter)}
                        className="px-2.5 py-1 font-medium transition-colors cursor-pointer capitalize"
                        style={{
                          color: isActive ? 'var(--accent-brand)' : 'var(--text-secondary)',
                          borderBottom: isActive ? '2px solid var(--accent-brand)' : '2px solid transparent',
                          borderRadius: 0,
                        }}
                      >
                        {filter.replace('-', ' ')}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="relative flex items-center px-3 py-1.5 text-[12px]"
                  style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
                >
                  <svg className="w-3.5 h-3.5 mr-2 shrink-0" style={{ color: 'var(--text-tertiary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                  <span className="font-medium mr-1.5" style={{ color: 'var(--text-tertiary)' }}>Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-transparent font-semibold focus:outline-none cursor-pointer pr-2"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <option value="rank">Strategy Rank (Default)</option>
                    <option value="price-desc">Price: High to Low</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="change-desc">Returns %: High to Low</option>
                    <option value="change-asc">Returns %: Low to High</option>
                    <option value="name-asc">Stock Name: A to Z</option>
                    <option value="upside-desc">Target Upside %</option>
                    <option value="rs-desc">Relative Strength (RS)</option>
                  </select>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search stock or sector..."
                    className="w-full sm:w-56 pl-9 pr-4 py-1.5 text-[12px] focus:outline-none placeholder:text-[color:var(--text-tertiary)]"
                    style={{ color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
                  />
                  <svg
                    className="w-4 h-4 absolute left-3 top-2"
                    style={{ color: 'var(--text-tertiary)' }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Stock Cards */}
            <div className="space-y-4 pt-2">
              {isScanning && (
                <div className="flex items-center justify-between pb-1 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: "var(--accent-brand)" }} />
                    Scanning stocks via Upstox ({progress.scanned} of {progress.total} - {progress.percent}%)...
                  </span>
                  {progress.currentSymbol && (
                    <span className="font-mono text-[11px]" style={{ color: "var(--text-tertiary)" }}>{progress.currentSymbol}</span>
                  )}
                </div>
              )}
              {isScanning && picks.length === 0 ? (
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 py-8"
                  role="status"
                  aria-live="polite"
                  aria-label="Fetching latest signals"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <div
                      key={n}
                      className="p-4 rounded-2xl border border-[color:var(--border-subtle)]"
                      style={{ backgroundColor: 'var(--elevated-1)' }}
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-9 h-9 rounded-lg" style={{ backgroundColor: 'var(--ground-secondary)' }} />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-3/4" style={{ backgroundColor: 'var(--ground-secondary)' }} />
                          <div className="h-2.5 w-1/2" style={{ backgroundColor: 'var(--ground-secondary)' }} />
                        </div>
                      </div>
                      <div className="h-2.5 mb-2" style={{ backgroundColor: 'var(--ground-secondary)' }} />
                      <div className="h-2.5 w-4/5" style={{ backgroundColor: 'var(--ground-secondary)' }} />
                      <div className="flex items-center justify-between mt-4 pt-2 border-t border-[color:var(--border-subtle)]">
                        <div className="h-2.5 w-1/3" style={{ backgroundColor: 'var(--ground-secondary)' }} />
                        <div className="h-4 w-16 rounded-md" style={{ backgroundColor: 'var(--ground-secondary)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {pagedPicks.map((stock, index) => (
                      <StockCard
                        key={stock.id}
                        stock={stock}
                        index={index}
                      />
                    ))}
                  </div>
                </AnimatePresence>
              )}

              {!isScanning && processedPicks.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="py-16 text-center rounded-3xl"
                  style={{
                    backgroundColor: 'var(--ground)',
                    border: '1px solid var(--border-default)',
                  }}
                >
                  <div
                    className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
                    style={{
                      backgroundColor: 'var(--elevated-2)',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    <Icon name="search" size={26} strokeWidth={1.75} />
                  </div>
                  <h4 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                    No Matching Stocks Found
                  </h4>
                  <p className="text-xs mt-1 max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>
                    Try switching market cap scope (Large/Mid/Small) or selecting
                    a different strategy from the left sidebar.
                  </p>
                </motion.div>
              )}
            </div>

            {/* Pagination */}
            {!isScanning && processedPicks.length > RESULTS_PER_PAGE && (
              <div className="pt-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(p) => {
                    setCurrentPage(p);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              </div>
            )}
          </main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <StrategyProvider>
        <ToastProvider>
          <ThemeBootstrap />
          <MobileBodyClass />
          <DashboardContent />
        </ToastProvider>
      </StrategyProvider>
    </ErrorBoundary>
  );
}

/** Mounts the theme hook at the app root so [data-theme] is applied before paint. */
function ThemeBootstrap() {
  useTheme();
  return null;
}

export default App;
