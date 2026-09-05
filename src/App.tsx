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
    <div className="flex flex-col min-h-screen selection:bg-slate-200 text-slate-800" style={{ color: 'var(--text-primary)', backgroundColor: 'var(--ground)' }}>
      {/* ===== TOP BAR (design2.md §3.1): fluid height via --topbar-h,
           fluid internal sizes via cqi of the .kite-topbar container. ===== */}
      <header className="kite-topbar">
        {/* Left side — brand + strategy name */}
        <div className="flex items-center min-w-0" style={{ gap: 'clamp(0.5rem, 2.2cqi, 1.5rem)', flex: '1 1 0%' }}>
          <div className="flex items-center shrink-0" style={{ gap: 'clamp(0.375rem, 1.2cqi, 0.625rem)' }}>
            <div
              className="rounded-md flex items-center justify-center"
              style={{
                width: 'var(--topbar-tile)',
                height: 'var(--topbar-tile)',
                backgroundColor: 'var(--accent-brand)',
              }}
            >
              <svg
                width="60%"
                height="60%"
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
            <span className="hidden 2xl:inline font-semibold whitespace-nowrap" style={{ color: 'var(--text-primary)', fontSize: 'var(--topbar-text)' }}>
              Quant Vision
            </span>
          </div>

          <div className="hidden lg:flex items-center min-w-0" style={{ gap: 'clamp(0.5rem, 1.6cqi, 1rem)', flex: '1 1 auto', minWidth: 0 }}>
            <div style={{ height: 'var(--topbar-divider-h)', width: '1px', backgroundColor: 'var(--border-default)', flexShrink: 0 }} />
            <span
              className="font-medium truncate min-w-0"
              style={{ color: 'var(--text-primary)', fontSize: 'var(--topbar-text)', flex: '1 1 0%' }}
            >
              {activeStrategy.name}
            </span>
            <span
              className="hidden 2xl:inline-block rounded font-semibold tracking-wide whitespace-nowrap"
              style={{
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--ground-secondary)',
                border: '1px solid var(--border-default)',
                padding: 'var(--topbar-pill-py) var(--topbar-pill-px)',
                fontSize: 'clamp(10px, 0.55cqi + 4px, 11px)',
                flex: '0 0 auto',
              }}
            >
              {capCategory.toUpperCase()} CAP
            </span>
          </div>
        </div>

        {/* Data source pill — separate topbar child so it doesn't squeeze the strategy name */}
        <div className="flex items-center shrink-0" style={{ gap: 'clamp(0.5rem, 1.6cqi, 1rem)' }}>
          <button
            onClick={() => setIsZerodhaModalOpen(true)}
            className={`flex items-center font-semibold cursor-pointer rounded-md border whitespace-nowrap ${isKiteLive ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'}`}
            style={{
              gap: 'clamp(0.25rem, 0.8cqi, 0.5rem)',
              padding: 'var(--topbar-pill-py) var(--topbar-pill-px)',
              fontSize: 'var(--topbar-text)',
            }}
            title="Click to configure Zerodha Kite API"
          >
            <span
              className="kite-status-dot"
              data-state={isKiteLive ? 'live' : 'fallback'}
              style={{
                backgroundColor: isKiteLive ? '#10b981' : '#d97706',
                width: 'clamp(6px, 0.5cqi + 2px, 8px)',
                height: 'clamp(6px, 0.5cqi + 2px, 8px)',
                borderRadius: '999px',
                flexShrink: 0,
              }}
            />
            <span>{isKiteLive ? 'Kite API Live' : 'yfinance'}</span>
          </button>
        </div>

        {/* Right side — nav links + actions */}
        <div className="flex items-center min-w-0" style={{ gap: 'clamp(0.5rem, 1.6cqi, 1rem)', flexShrink: 1 }}>
          {/* Nav links — Kite-style horizontal list, brand colour for active */}
          <nav
            className="hidden md:flex items-center font-medium"
            style={{ gap: 'clamp(0.625rem, 1.8cqi, 1.25rem)', fontSize: 'var(--topbar-text)' }}
          >
            {([
              { id: 'signals', label: 'Signals' },
              { id: 'sector-heatmap', label: 'Sectors' },
              { id: 'executions', label: 'Trades' },
              { id: 'analytics', label: 'P&L' },
              { id: 'settings', label: 'Settings' },
            ] as const).map((t) => {
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className="cursor-pointer transition-colors"
                  style={{
                    color: isActive ? 'var(--accent-brand)' : 'var(--text-secondary)',
                    fontWeight: isActive ? 600 : 500,
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </nav>

          {/* Capital + User + Rescan */}
          <div className="flex items-center" style={{ gap: 'clamp(0.375rem, 1cqi, 0.5rem)' }}>
            <CapitalBar isLoggedIn={isLoggedIn} />

            {user ? (
              <div className="flex items-center" style={{ gap: 'clamp(0.375rem, 1cqi, 0.5rem)' }}>
                <div
                  className="hidden sm:flex items-center"
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: 'var(--topbar-text)',
                    gap: 'clamp(0.25rem, 0.8cqi, 0.5rem)',
                    padding: 'clamp(0.125rem, 0.4cqi, 0.25rem) clamp(0.375rem, 1cqi, 0.5rem)',
                  }}
                >
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {(profile?.full_name || user.email?.split('@')[0] || 'User')}
                  </span>
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    {profile?.paper_trading_enabled ? 'Paper' : 'Live'}
                  </span>
                </div>
                <button
                  onClick={() => signOut()}
                  className="cursor-pointer"
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: 'var(--topbar-text)',
                    padding: 'clamp(0.125rem, 0.4cqi, 0.25rem) clamp(0.375rem, 1cqi, 0.5rem)',
                  }}
                  title="Sign out"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="font-medium cursor-pointer"
                style={{
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '0.375rem',
                  fontSize: 'var(--topbar-text)',
                  padding: 'clamp(0.25rem, 0.7cqi, 0.375rem) clamp(0.625rem, 1.4cqi, 0.75rem)',
                }}
              >
                Sign in
              </button>
            )}

            {/* Standalone Connect-Zerodha pill — hidden when Kite is live
                (data-source pill already shows the same state). */}
            {!isKiteLive && (
              <button
                onClick={() => setIsZerodhaModalOpen(true)}
                className="font-medium cursor-pointer hidden xl:inline-block"
                style={{
                  color: 'var(--accent-brand)',
                  fontSize: 'var(--topbar-text)',
                  padding: 'clamp(0.125rem, 0.4cqi, 0.25rem) clamp(0.375rem, 1cqi, 0.5rem)',
                }}
                title="Connect Zerodha Kite for live data"
              >
                Connect Zerodha
              </button>
            )}

            <button
              onClick={() => runScanWithToast()}
              disabled={isScanning}
              aria-label={isScanning ? 'Scanning' : 'Rescan strategy'}
              className="kite-button-primary flex items-center"
              style={{
                opacity: isScanning ? 0.6 : 1,
                cursor: isScanning ? 'not-allowed' : 'pointer',
                gap: 'clamp(0.25rem, 0.7cqi, 0.375rem)',
                padding: 'clamp(0.25rem, 0.7cqi, 0.375rem) clamp(0.625rem, 1.6cqi, 0.875rem)',
                fontSize: 'var(--topbar-text)',
              }}
            >
              <svg
                className={isScanning ? 'animate-spin' : ''}
                width="clamp(12px, 0.85cqi + 6px, 16px)"
                height="clamp(12px, 0.85cqi + 6px, 16px)"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.25}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{isScanning ? 'Scanning...' : 'Rescan'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ===== BODY: 100vh - 60px, flex row, sidebar + main (no full-page scroll). ===== */}
      <div className="kite-body">
        {/* Left pane — Kite sidebar. On mobile, swap to a drawer. */}
        <MobileSidebarDrawer>
          <Sidebar />
        </MobileSidebarDrawer>

        {/* Main pane — fluid width, scrolls independently. */}
        <main className="kite-main">
          {/* Heading row (page title + subtitle). On mobile we show the
              strategy name here because the top bar's strategy subtitle is
              hidden; on desktop the top bar already shows the same, so we
              collapse to a small subtitle to avoid duplication. */}
          <div className="flex flex-col gap-1 mb-6">
            <h1 className="hidden lg:block text-[13px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              {activeStrategy.name}
            </h1>
            <h1 className="lg:hidden text-[22px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {activeStrategy.name}
            </h1>
            <p className="text-[13px] flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
              <span>Zerodha-momentum swing picks, screened across the active market cap scope.</span>
              <InfoTooltip
                label="About this strategy"
                content={activeStrategy.description}
                side="bottom"
                size="md"
              />
            </p>
          </div>

            {/* View-mode tabs (mobile only — desktop nav is in the top bar) */}
            <div className="lg:hidden flex flex-wrap items-center gap-2 pb-3 mb-2 border-b" style={{ borderColor: 'var(--border-default)' }}>
              <button
                onClick={() => setActiveTab('signals')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  activeTab === 'signals'
                    ? 'bg-[color:var(--accent-blue)] text-white shadow-md'
                    : 'bg-[color:var(--elevated-1)] hover:bg-[color:var(--elevated-2)] text-[color:var(--text-secondary)] border border-[color:var(--glass-border-subtle)]'
                }`}
              >
                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Signals</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold">
                  {picks.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('sector-heatmap')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  activeTab === 'sector-heatmap'
                    ? 'bg-[color:var(--accent-blue)] text-white shadow-md'
                    : 'bg-[color:var(--elevated-1)] hover:bg-[color:var(--elevated-2)] text-[color:var(--text-secondary)] border border-[color:var(--glass-border-subtle)]'
                }`}
              >
                <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Sectors</span>
              </button>

              <button
                onClick={() => setActiveTab('executions')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  activeTab === 'executions'
                    ? 'bg-[color:var(--accent-blue)] text-white shadow-md'
                    : 'bg-[color:var(--elevated-1)] hover:bg-[color:var(--elevated-2)] text-[color:var(--text-secondary)] border border-[color:var(--glass-border-subtle)]'
                }`}
              >
                <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span>Trades</span>
              </button>

              <button
                onClick={() => setActiveTab('analytics')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  activeTab === 'analytics'
                    ? 'bg-[color:var(--accent-blue)] text-white shadow-md'
                    : 'bg-[color:var(--elevated-1)] hover:bg-[color:var(--elevated-2)] text-[color:var(--text-secondary)] border border-[color:var(--glass-border-subtle)]'
                }`}
              >
                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>P&amp;L</span>
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  activeTab === 'settings'
                    ? 'bg-[color:var(--accent-blue)] text-white shadow-md'
                    : 'bg-[color:var(--elevated-1)] hover:bg-[color:var(--elevated-2)] text-[color:var(--text-secondary)] border border-[color:var(--glass-border-subtle)]'
                }`}
              >
                <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Settings</span>
              </button>
            </div>

            {/* Metrics Overview Strip — design2.md: large, hairline-bordered tiles,
                subtle small labels, single data colour. */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="kite-metric">
                <p className="kite-metric-label">Qualified Picks</p>
                <p className="kite-metric-value" style={{ color: 'var(--text-primary)' }}>{picks.length}</p>
              </div>
              <div className="kite-metric">
                <p className="kite-metric-label">Strong Buy</p>
                <p className="kite-metric-value" style={{ color: 'var(--success-green)' }}>{strongBuyCount}</p>
              </div>
              <div className="kite-metric">
                <p className="kite-metric-label">Buy Signals</p>
                <p className="kite-metric-value" style={{ color: 'var(--accent-blue)' }}>{buyCount}</p>
              </div>
              <div className="kite-metric">
                <p className="kite-metric-label">Avg Target 1 Upside</p>
                <p className="kite-metric-value" style={{ color: 'var(--success-green)' }}>+{avgUpside}%</p>
              </div>
            </div>

            {/* Strategy Rules Accordion Card — collapsed by default so the
                UI stays lean; users tap the header to read the full rule set. */}
            <div className="mt-3">
              {/* Strategy pill — shows active strategy name, always visible above the card */}
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[11px] font-semibold text-[color:var(--accent-brand)] bg-[color:var(--accent-brand)]/10 px-2.5 py-1 rounded-full border border-[color:var(--accent-brand)]/20">
                  {activeStrategy.shortName}
                </span>
                <span className="text-[11px] text-[color:var(--text-quaternary)]">
                  {activeStrategy.rules.length} rules
                </span>
              </div>

              <ExpandableCard
                title="Strategy Criteria & Rules"
                defaultOpen={false}
                icon={
                  <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              >
                {/* Strategy description — shown at the top of the expanded body */}
                {activeStrategy.description && (
                  <p className="mb-4 text-xs leading-relaxed text-[color:var(--text-secondary)] bg-[color:var(--accent-blue-bg)] border border-[color:var(--accent-blue)]/20 px-4 py-3 rounded-xl">
                    {activeStrategy.description}
                  </p>
                )}

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
                        {/* Category chip */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 mt-0.5 uppercase tracking-wide ${chipClass}`}>
                          {ruleCategory}
                        </span>
                        {/* Number circle */}
                        <span className={`w-5 h-5 rounded-full font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5 ${numClass}`}>
                          {idx + 1}
                        </span>
                        {/* Rule text */}
                        <span className="text-sm leading-snug text-[color:var(--text-secondary)] flex-1">{rule}</span>
                      </li>
                    );
                  })}
                </ul>
              </ExpandableCard>
            </div>

            {/* Tab Body View */}
            {activeTab === 'sector-heatmap' ? (
              <SectorStrengthExplorer />
            ) : (
              <>
                {/* Filters & Search Control Bar (Zerodha Kite Style) */}
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pt-4 mt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Cap Filter Pills — design2.md: hairline pills, brand accent for active. */}
                    <div className="flex items-center gap-1 text-[12px]">
                      <span className="px-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Cap:</span>
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

                    {/* Signal Filter Pills — same hairline underline style. */}
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
                    {/* Sort Selector — hairline-bordered, no shadow. */}
                    <div
                      className="relative flex items-center px-3 py-1.5 text-[12px] font-medium"
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
                        <option value="price-desc">Price: High → Low</option>
                        <option value="price-asc">Price: Low → High</option>
                        <option value="change-desc">Returns %: High → Low</option>
                        <option value="change-asc">Returns %: Low → High</option>
                        <option value="name-asc">Stock Name: A → Z</option>
                        <option value="upside-desc">Target Upside %</option>
                        <option value="rs-desc">Relative Strength (RS)</option>
                      </select>
                    </div>

                    {/* Search Box — hairline border, no glass. */}
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

