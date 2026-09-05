import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StrategyProvider, useStrategy } from './context/StrategyContext';
import { Sidebar } from './components/Sidebar';
import { MobileSidebarDrawer } from './components/MobileSidebarDrawer';
import { MobileBodyClass } from './components/MobileBodyClass';
import { StockCard } from './components/StockCard';
import { ExpandableCard } from './components/ExpandableCard';
import { ZerodhaLoginModal } from './components/ZerodhaLoginModal';
import { SectorStrengthExplorer } from './components/SectorStrengthExplorer';
import { CapitalBar } from './components/CapitalBar';
import { ExecuteModal } from './components/ExecuteModal';
import { ExecutionTracker } from './components/ExecutionTracker';
import { ToastProvider } from './components/ToastProvider';
import { useToast } from './components/useToast';
import { MobileNav, type MobileNavTab } from './components/MobileNav';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { AuthPage } from './components/AuthPage';
import { PnLAnalytics } from './components/PnLAnalytics';
import { SettingsPage } from './components/SettingsPage';
import { Pagination } from './components/Pagination';
import { InfoTooltip } from './components/InfoTooltip';
import { GlassCard } from './components/GlassCard';
import { useTheme } from './hooks/useTheme';
import { authFetch } from './lib/authFetch';
import type { StockPick } from './engine/types';

const RESULTS_PER_PAGE = 12;

/**
 * On app mount, detect a Zerodha OAuth callback in the URL
 * (?request_token=...) and silently exchange it for an access_token
 * via the backend. We do this at the top level (not just inside the
 * modal) so the user lands back on the dashboard and sees a toast
 * saying "Zerodha connected" — no re-entering credentials, no looping.
 *
 * If anything goes wrong (no API key/secret in DB, Kite API error),
 * we open the modal so the user can fix the issue.
 */
function useZerodhaOAuthAutoExchange(
  getAccessToken: () => Promise<string | null>,
  onSuccess: () => void,
  onNeedsCredentials: () => void,
  onError: (message: string) => void
) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const requestToken = params.get('request_token');
    const status = params.get('status');
    if (!requestToken || status === 'error') return;

    // Clean the URL immediately so refreshes don't re-trigger
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);

    // Exchange silently
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          onNeedsCredentials();
          return;
        }
        const res = await fetch('/api/kite/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ requestToken }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          // If credentials are missing, prompt the user via the modal
          if (res.status === 400 && /not configured|api key/i.test(data.error || '')) {
            onNeedsCredentials();
            return;
          }
          throw new Error(data.error || `Token exchange failed (${res.status})`);
        }
        // Cache the access token in localStorage so the rest of the app
        // can use it without a round trip
        try {
          const STORAGE_KEY = 'zerodha_kite_credentials';
          const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              ...existing,
              accessToken: data.access_token,
              requestToken,
              loginTime: new Date().toISOString(),
            })
          );
        } catch {
          /* localStorage is optional */
        }
        onSuccess();
      } catch (err: any) {
        onError(err.message || 'Failed to connect Zerodha');
      }
    })();
  }, [getAccessToken, onSuccess, onNeedsCredentials, onError]);
}

function DashboardContent() {
  const {
    activeStrategy,
    capCategory,
    picks,
    isScanning,
    searchQuery,
    setSearchQuery,
    signalFilter,
    setSignalFilter,
    sortBy,
    setSortBy,
    resultCapFilter,
    setResultCapFilter,
    activeDataSource,
    isZerodhaModalOpen,
    setIsZerodhaModalOpen,
    runScan,
  } = useStrategy();

  const { user, profile, signOut, getAccessToken } = useAuth();
  const toast = useToast();

  // Silently exchange request_token on mount if the URL has one
  // (i.e. we just got redirected back from kite.zerodha.com OAuth).
  // No UI shown to the user — just a toast on success/failure.
  useZerodhaOAuthAutoExchange(
    getAccessToken,
    () => {
      toast.success('Zerodha Connected — Live Kite API is now active.');
      runScan();
    },
    () => {
      setIsZerodhaModalOpen(true);
      toast.warning('Enter your Zerodha API key and secret to finish connecting.');
    },
    (msg) => {
      toast.error(`Zerodha connection failed: ${msg}`);
    }
  );

  const [activeTab, setActiveTab] = useState<'signals' | 'sector-heatmap' | 'executions' | 'analytics' | 'settings'>('signals');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStockForExecute, setSelectedStockForExecute] = useState<StockPick | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [capitalData, setCapitalData] = useState<{
    availableCapital: number;
    riskLimitPct: number;
  } | null>(null);

  const isLoggedIn = !!user;

  /**
   * User-initiated scan with toast feedback.
   * Wraps `runScan` so the manual "Rescan Strategy" button surfaces
   * success / failure toasts instead of failing silently. Auto-scans
   * (on mount or strategy/cap change) stay silent to avoid toast spam.
   */
  const runScanWithToast = async () => {
    if (isScanning) return;
    try {
      await runScan();
      toast.success('Scan complete.');
    } catch (err: any) {
      toast.error(`Scan failed: ${err?.message || 'Unknown error'}`);
    }
  };

  // Mobile bottom-nav tabs (icons are short emoji per MobileNav contract)
  const mobileNavTabs: MobileNavTab[] = [
    { id: 'signals', label: 'Signals', icon: '⚡' },
    { id: 'sector-heatmap', label: 'Sectors', icon: '📊' },
    { id: 'executions', label: 'Trades', icon: '📋' },
    { id: 'analytics', label: 'P&L', icon: '📈' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  const handleExecute = async (params: any) => {
    if (params.isPaperTrading) {
      // Paper trading - create simulated position
      const response = await authFetch('/api/paper-positions', {
        method: 'POST',
        body: JSON.stringify({
          strategy_id: activeStrategy.id,
          strategy_name: activeStrategy.name,
          symbol: params.symbol,
          name: params.name || params.symbol,
          sector: params.sector || 'Unknown',
          cap_category: params.capCategory || 'large',
          entry_price: params.entryPrice,
          stop_loss: params.stopLoss,
          target1: params.target1,
          target2: params.target2,
          quantity: params.quantity,
          risk_amount: params.riskAmount,
          risk_pct: params.riskPct,
          charges_estimate: params.charges,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Paper trade failed');
      }

      const result = await response.json();
      console.log('Paper trade executed:', result);
      toast.success(`Paper position opened: ${params.symbol} × ${params.quantity}`);
      return result;
    }

    // Live trading - real order flow.
    // 1. Create strategy_executions row (status='pending') via /api/executions
    // 2. Place entry order on Kite via /api/kite/orders (action=orders)
    // 3. Place OCO GTT (target + stop-loss) via /api/kite/gtt (action=gtt)
    // Each step uses authFetch so the Supabase Bearer token is auto-injected.
    const executionResponse = await authFetch('/api/executions', {
      method: 'POST',
      body: JSON.stringify({
        strategy_id: activeStrategy.id,
        strategy_name: activeStrategy.name,
        symbol: params.symbol,
        name: params.name || params.symbol,
        sector: params.sector || 'Unknown',
        cap_category: params.capCategory || 'large',
        exchange: params.exchange || 'NSE',
        entry_price: params.entryPrice,
        stop_loss: params.stopLoss,
        target1: params.target1,
        target2: params.target2,
        quantity: params.quantity,
        product: params.product || 'CNC',
        risk_amount: params.riskAmount,
        risk_pct: params.riskPct,
        charges_estimate: params.charges,
        is_paper_trade: false,
      }),
    });
    if (!executionResponse.ok) {
      const error = await executionResponse.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to create execution record');
    }
    const execution = await executionResponse.json();
    console.log('Execution record created:', execution);

    const orderResponse = await authFetch('/api/kite/orders', {
      method: 'POST',
      body: JSON.stringify({
        variety: 'regular',
        tradingsymbol: params.symbol,
        exchange: params.exchange || 'NSE',
        transaction_type: params.transactionType || 'BUY',
        order_type: 'LIMIT',
        quantity: params.quantity,
        product: params.product || 'CNC',
        price: params.entryPrice,
        tag: `strategy:${activeStrategy.id}`,
      }),
    });
    if (!orderResponse.ok) {
      const error = await orderResponse.json().catch(() => ({}));
      throw new Error(error.error || 'Kite entry order failed');
    }
    const order = await orderResponse.json();
    console.log('Kite entry order placed:', order);

    // OCO GTT: leg 1 = target exit (SELL LIMIT @ target1), leg 2 = stop-loss (SELL SL-M @ stopLoss)
    const gttResponse = await authFetch('/api/kite/gtt', {
      method: 'POST',
      body: JSON.stringify({
        type: 'two-leg',
        tradingsymbol: params.symbol,
        exchange: params.exchange || 'NSE',
        trigger_values: [params.target1, params.stopLoss],
        last_price: params.entryPrice,
        orders: [
          {
            transaction_type: 'SELL',
            quantity: params.quantity,
            order_type: 'LIMIT',
            product: params.product || 'CNC',
            price: params.target1,
          },
          {
            transaction_type: 'SELL',
            quantity: params.quantity,
            order_type: 'SL-M',
            product: params.product || 'CNC',
          },
        ],
      }),
    });
    if (!gttResponse.ok) {
      const error = await gttResponse.json().catch(() => ({}));
      throw new Error(error.error || 'Kite GTT placement failed');
    }
    const gtt = await gttResponse.json();
    console.log('Kite GTT placed:', gtt);

    toast.success(
      `Live order placed: ${params.symbol} × ${params.quantity} (order ${order.order_id ?? 'ok'})`
    );
    return { execution, order, gtt };
  };

  // Fetch capital data for execute modal
  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await authFetch('/api/capital');
        if (!response.ok) throw new Error(`/api/capital ${response.status}`);
        const data = await response.json();
        if (cancelled) return;
        setCapitalData({
          availableCapital: data.availableCapital,
          riskLimitPct: data.riskLimits?.riskPerTradePct || 2,
        });
      } catch (err) {
        console.error('Failed to fetch capital:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  // Reset to first page whenever the result set or sort changes shape
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, signalFilter, resultCapFilter, sortBy, picks.length, activeTab]);

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
        const upsideA = ((a.signalDetails.target1 - a.currentPrice) / a.currentPrice) * 100;
        const upsideB = ((b.signalDetails.target1 - b.currentPrice) / b.currentPrice) * 100;
        return upsideB - upsideA;
      }
      if (sortBy === 'rs-desc') {
        return (
          b.signalDetails.indicators.relativeStrengthVsSector -
          a.signalDetails.indicators.relativeStrengthVsSector
        );
      }
      return 0; // Default rank (scanner engine order)
    });

  const strongBuyCount = picks.filter((p) => p.signal === 'strong-buy').length;
  const buyCount = picks.filter((p) => p.signal === 'buy').length;

  // Slice into pages only on the signals tab
  const totalPages = activeTab === 'signals'
    ? Math.max(1, Math.ceil(processedPicks.length / RESULTS_PER_PAGE))
    : 1;
  const pagedPicks = activeTab === 'signals'
    ? processedPicks.slice((currentPage - 1) * RESULTS_PER_PAGE, currentPage * RESULTS_PER_PAGE)
    : processedPicks;

  const avgUpside = picks.length
    ? (
        picks.reduce(
          (acc, p) =>
            acc +
            ((p.signalDetails.target1 - p.currentPrice) / p.currentPrice) * 100,
          0
        ) / picks.length
      ).toFixed(1)
    : '0';

  const isKiteLive = activeDataSource.includes('Kite');

  return (
    <div className="min-h-screen pb-24 lg:pb-12 selection:bg-slate-200 relative overflow-hidden text-slate-800">
      {/* Background Ambient Blur Glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <motion.div
          className="absolute w-[650px] h-[650px] rounded-full blur-3xl opacity-30"
          style={{
            background:
              'radial-gradient(circle, rgba(14,165,233,0.2) 0%, rgba(99,102,241,0.05) 60%, transparent 80%)',
            top: '-200px',
            right: '-100px',
          }}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full blur-3xl opacity-25"
          style={{
            background:
              'radial-gradient(circle, rgba(16,185,129,0.18) 0%, transparent 70%)',
            bottom: '-150px',
            left: '-100px',
          }}
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="relative z-10 max-w-[1680px] w-full mx-auto px-4 sm:px-6 lg:px-10 xl:px-12 pt-6 sm:pt-10">
        {/* Main 2-Column Sidebar Layout */}
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Left Strategy Selector Sidebar */}
          <MobileSidebarDrawer>
            <Sidebar />
          </MobileSidebarDrawer>

          {/* Right Main Content */}
          <main className="flex-1 w-full min-w-0 space-y-6">
            {/* Header Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    {activeStrategy.name}
                  </h2>
                  <span className="px-2.5 py-0.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300/80 rounded-full">
                    {capCategory.toUpperCase()} CAP
                  </span>
                  
                  {/* Active Data Source Notification in Top Right Area */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsZerodhaModalOpen(true)}
                      className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                        isKiteLive
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                          : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${isKiteLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                      <span>Data Source: <strong>{activeDataSource}</strong></span>
                      <svg className="w-3 h-3 ml-0.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed font-medium max-w-2xl inline-flex items-start gap-1.5">
                  <span className="truncate">Zerodha-momentum swing picks, screened across the active market cap scope.</span>
                  <InfoTooltip
                    label="About this strategy"
                    content={activeStrategy.description}
                    side="bottom"
                    size="md"
                  />
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {/* Capital Bar - Top Right */}
                <CapitalBar
                  isLoggedIn={isLoggedIn}
                />

                {/* User Account / Auth Button */}
                {user ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 border border-slate-200 shadow-xs">
                      <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">
                        {(profile?.full_name || user.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="hidden sm:block">
                        <p className="text-[10px] font-bold text-slate-800 leading-tight max-w-[100px] truncate">
                          {profile?.full_name || user.email?.split('@')[0]}
                        </p>
                        <p className="text-[9px] text-slate-400 leading-tight">
                          {profile?.paper_trading_enabled ? 'Paper Trading' : 'Live Trading'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => signOut()}
                      className="px-2.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-all cursor-pointer"
                      title="Sign out"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-98"
                  >
                    <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>Sign In</span>
                  </button>
                )}

                {/* Zerodha Login / Connect Button — demoted to a quiet pill */}
                <button
                  onClick={() => setIsZerodhaModalOpen(true)}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-[color:var(--text-secondary)] bg-[color:var(--elevated-1)] hover:bg-orange-50 hover:text-orange-700 border border-[color:var(--glass-border-subtle)] transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Connect Zerodha Kite for live data"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  <span>Connect Zerodha</span>
                </button>

                <button
                  onClick={() => runScanWithToast()}
                  disabled={isScanning}
                  aria-label={isScanning ? 'Scanning' : 'Rescan strategy'}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[color:var(--elevated-1)] hover:bg-[color:var(--elevated-2)] text-[color:var(--text-primary)] border border-[color:var(--glass-border-subtle)] shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-98 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <svg
                    className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <span>{isScanning ? 'Scanning...' : 'Rescan Strategy'}</span>
                </button>
              </div>
            </div>

            {/* View Mode Navigation Switcher Tabs — desktop only; mobile uses bottom MobileNav.
                Uses the design-system tokens so the nav doesn't jar against the vision-glass cards. */}
            <div className="hidden lg:flex items-center gap-2 border-b border-[color:var(--glass-border-subtle)] pb-3">
              <button
                onClick={() => setActiveTab('signals')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'signals'
                    ? 'bg-[color:var(--accent-blue)] text-white shadow-md'
                    : 'bg-[color:var(--elevated-1)] hover:bg-[color:var(--elevated-2)] text-[color:var(--text-secondary)] border border-[color:var(--glass-border-subtle)]'
                }`}
              >
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Swing Signals Screener</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold">
                  {picks.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('sector-heatmap')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'sector-heatmap'
                    ? 'bg-[color:var(--accent-blue)] text-white shadow-md'
                    : 'bg-[color:var(--elevated-1)] hover:bg-[color:var(--elevated-2)] text-[color:var(--text-secondary)] border border-[color:var(--glass-border-subtle)]'
                }`}
              >
                <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Equal-Weighted Sector NAV Heatmap</span>
              </button>

              <button
                onClick={() => setActiveTab('executions')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'executions'
                    ? 'bg-[color:var(--accent-blue)] text-white shadow-md'
                    : 'bg-[color:var(--elevated-1)] hover:bg-[color:var(--elevated-2)] text-[color:var(--text-secondary)] border border-[color:var(--glass-border-subtle)]'
                }`}
              >
                <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span>Strategy Executions</span>
              </button>

              <button
                onClick={() => setActiveTab('analytics')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'analytics'
                    ? 'bg-[color:var(--accent-blue)] text-white shadow-md'
                    : 'bg-[color:var(--elevated-1)] hover:bg-[color:var(--elevated-2)] text-[color:var(--text-secondary)] border border-[color:var(--glass-border-subtle)]'
                }`}
              >
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>P&L Analytics</span>
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-[color:var(--accent-blue)] text-white shadow-md'
                    : 'bg-[color:var(--elevated-1)] hover:bg-[color:var(--elevated-2)] text-[color:var(--text-secondary)] border border-[color:var(--glass-border-subtle)]'
                }`}
              >
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Settings</span>
              </button>
            </div>

            {/* Metrics Overview Strip — uses vision-glass tiles so it visually
                matches the rest of the design system instead of bare white. */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <GlassCard
                variant="blob"
                signal="neutral"
                padding="md"
                className="h-full"
              >
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[color:var(--text-tertiary)] block mb-2">
                  Qualified Picks
                </span>
                <p className="text-2xl font-extrabold text-[color:var(--text-primary)] tracking-tight leading-none tabular-nums">
                  {picks.length}
                </p>
              </GlassCard>
              <GlassCard
                variant="blob"
                signal="strong-buy"
                padding="md"
                className="h-full"
              >
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[color:var(--text-tertiary)] block mb-2">
                  Strong Buy
                </span>
                <p className="text-2xl font-extrabold text-[color:var(--success-green)] tracking-tight leading-none tabular-nums">
                  {strongBuyCount}
                </p>
              </GlassCard>
              <GlassCard
                variant="blob"
                signal="buy"
                padding="md"
                className="h-full"
              >
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[color:var(--text-tertiary)] block mb-2">
                  Buy Signals
                </span>
                <p className="text-2xl font-extrabold text-[color:var(--accent-blue)] tracking-tight leading-none tabular-nums">
                  {buyCount}
                </p>
              </GlassCard>
              <GlassCard
                variant="blob"
                signal="strong-buy"
                padding="md"
                className="h-full"
              >
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[color:var(--text-tertiary)] block mb-2">
                  Avg Target 1 Upside
                </span>
                <p className="text-2xl font-extrabold text-[color:var(--success-green)] tracking-tight leading-none tabular-nums">
                  +{avgUpside}%
                </p>
              </GlassCard>
            </div>

            {/* Strategy Rules Accordion Card — collapsed by default so the
                UI stays lean; users tap the header to read the full rule set. */}
            <ExpandableCard
              title="Strategy Criteria & Rules"
              defaultOpen={false}
              icon={
                <svg className="w-3.5 h-3.5 text-[color:var(--text-secondary)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              badge={
                <span className="text-[11px] font-bold text-[color:var(--text-secondary)] bg-[color:var(--elevated-2)] px-2.5 py-0.5 rounded-full border border-[color:var(--glass-border-subtle)]">
                  {activeStrategy.rules.length} Rules Active
                </span>
              }
            >
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-[color:var(--text-secondary)] font-medium">
                {activeStrategy.rules.map((rule, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-[color:var(--glass-bg-hover)] transition-colors">
                    <span className="w-5 h-5 rounded-full bg-[color:var(--elevated-2)] text-[color:var(--text-primary)] font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5 border border-[color:var(--glass-border-subtle)]">
                      {idx + 1}
                    </span>
                    <span className="leading-snug pt-0.5">{rule}</span>
                  </li>
                ))}
              </ul>
            </ExpandableCard>

            {/* Tab Body View */}
            {activeTab === 'sector-heatmap' ? (
              <SectorStrengthExplorer />
            ) : (
              <>
                {/* Filters & Search Control Bar (Zerodha Kite Style) */}
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Result Market Cap Category Filter Pills */}
                    <div className="flex items-center gap-1 p-1 rounded-xl vision-glass border border-slate-200/60 text-xs">
                      <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Cap:</span>
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
                            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                              isActive
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                            }`}
                          >
                            {capItem.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Signal Filter Pills */}
                    <div className="flex items-center gap-1 p-1 rounded-xl vision-glass border border-slate-200/60 text-xs">
                      <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Signal:</span>
                      {(['all', 'strong-buy', 'buy', 'hold'] as const).map((filter) => {
                        const isActive = signalFilter === filter;
                        return (
                          <button
                            key={filter}
                            onClick={() => setSignalFilter(filter)}
                            className={`px-2.5 py-1 rounded-lg font-medium transition-all capitalize ${
                              isActive
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                            }`}
                          >
                            {filter.replace('-', ' ')}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Zerodha Kite-Style Sort Selector */}
                    <div className="relative flex items-center vision-glass border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white/70 shadow-2xs">
                      <svg className="w-3.5 h-3.5 text-slate-500 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                      </svg>
                      <span className="text-slate-400 font-medium mr-1.5">Sort:</span>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer pr-2"
                      >
                        <option value="rank">Strategy Rank (Default)</option>
                        <option value="price-desc">Price: High → Low</option>
                        <option value="price-asc">Price: Low → High</option>
                        <option value="change-desc">Returns %: High → Low</option>
                        <option value="change-asc">Returns %: Low → High</option>
                        <option value="name-asc">Stock Name: A → Z</option>
                        <option value="upside-desc">Target Upside %</option>
                        <option value="rs-desc">Relative Strength (RS)</option>
                      </select>
                    </div>

                    {/* Search Box */}
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search stock or sector..."
                        className="w-full sm:w-56 pl-9 pr-4 py-1.5 rounded-xl text-xs vision-glass border border-slate-200/80 focus:outline-none focus:ring-2 focus:ring-slate-400 placeholder:text-slate-400"
                      />
                      <svg
                        className="w-4 h-4 text-slate-400 absolute left-3 top-2"
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

                {/* Stock Pick Cards Container */}
                <div className="space-y-4 pt-2">
                  {(() => {
                    const currentTab: string = activeTab;
                    if (currentTab === 'signals') {
                      return (
                        <>
                          {isScanning ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 py-8">
                              {[1, 2, 3, 4].map((n) => (
                                <div
                                  key={n}
                                  className="h-40 rounded-2xl vision-glass animate-pulse border border-slate-200/50"
                                />
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
                                    onOpenExecuteModal={(stk) => setSelectedStockForExecute(stk)}
                                  />
                                ))}
                              </div>
                            </AnimatePresence>
                          )}

                          {/* Pagination */}
                          {activeTab === 'signals' && !isScanning && processedPicks.length > RESULTS_PER_PAGE && (
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

                          {/* Empty state when no picks match */}
                          {!isScanning && processedPicks.length === 0 && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="py-16 text-center vision-glass rounded-3xl border border-slate-200/60"
                            >
                              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 mb-3">
                                <svg
                                  className="w-6 h-6"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={1.5}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                  />
                                </svg>
                              </div>
                              <h4 className="text-base font-semibold text-slate-800">
                                No Matching Stocks Found
                              </h4>
                              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                                Try switching market cap scope (Large/Mid/Small) or selecting
                                a different strategy from the left sidebar.
                              </p>
                            </motion.div>
                          )}
                        </>
                      );
                    }
                    if (currentTab === 'sector-heatmap') {
                      return <SectorStrengthExplorer />;
                    }
                    if (currentTab === 'executions') {
                      return (
                        <ExecutionTracker
                          key={isLoggedIn ? 'authed' : 'guest'}
                          isLoggedIn={isLoggedIn}
                        />
                      );
                    }
                    if (currentTab === 'analytics') {
                      return (
                        <PnLAnalytics
                          key={isLoggedIn ? 'authed' : 'guest'}
                          isLoggedIn={isLoggedIn}
                          onLoginClick={() => setIsZerodhaModalOpen(true)}
                        />
                      );
                    }
                    if (currentTab === 'settings') {
                      return (
                        <SettingsPage
                          key={isLoggedIn ? 'authed' : 'guest'}
                          isLoggedIn={isLoggedIn}
                          onLoginClick={() => setIsAuthModalOpen(true)}
                        />
                      );
                    }
                    return null;
                  })()}
                </div>
              </>
            )}
          </main>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-6 border-t border-slate-200/60 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 font-medium">
            <p>
              Quant Vision Screener • Wagner & Pedicelli Relative Strength Engine
            </p>
            <p className="flex items-center gap-1.5">
              <span>Parallel Multi-Cap Screener</span>
              <span>•</span>
              <span className="text-slate-600 font-semibold">Vision OS Glass</span>
            </p>
          </div>
        </footer>

        {/* Mobile bottom tab bar — hidden on desktop, shown on mobile */}
        <MobileNav
          tabs={mobileNavTabs}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as typeof activeTab)}
        />

        {/* Zerodha Login & Settings Modal */}
        <ZerodhaLoginModal
          isOpen={isZerodhaModalOpen}
          onClose={() => setIsZerodhaModalOpen(false)}
          onCredentialsUpdated={() => runScan()}
        />

        {/* Execute Trade Modal */}
        <ExecuteModal
          key={selectedStockForExecute ? `exec-${selectedStockForExecute.id || selectedStockForExecute.symbol}` : 'exec-closed'}
          isOpen={!!selectedStockForExecute}
          stock={selectedStockForExecute}
          onClose={() => setSelectedStockForExecute(null)}
          onExecute={handleExecute}
          isLoggedIn={isLoggedIn}
          availableCapital={capitalData?.availableCapital || 0}
          riskLimitPct={capitalData?.riskLimitPct || 2}
          isPaperTrading={profile?.paper_trading_enabled ?? true}
        />

        {/* Auth Modal */}
        {isAuthModalOpen && (
          <AuthPage onClose={() => setIsAuthModalOpen(false)} />
        )}
      </div>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <StrategyProvider>
        <ToastProvider>
          <ThemeBootstrap />
          <MobileBodyClass />
          <DashboardContent />
        </ToastProvider>
      </StrategyProvider>
    </AuthProvider>
  );
}

/** Mounts the theme hook at the app root so [data-theme] is applied before paint. */
function ThemeBootstrap() {
  useTheme();
  return null;
}

export default App;

