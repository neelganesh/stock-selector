import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
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
import { Icon } from './components/Icon';
import { AnimatedNumber } from './components/AnimatedNumber';

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
    progress,
    runScan,
    isPaperOnly,
    setIsPaperOnly,
  } = useStrategy();

  const { user, profile, getAccessToken, signOut } = useAuth();
  const toast = useToast();
  const prefersReducedMotion = useReducedMotion();

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
  const [isLoginCardOpen, setIsLoginCardOpen] = useState(false);
  const loginDropdownRef = useRef<HTMLDivElement>(null);
  const [capitalData, setCapitalData] = useState<{
    availableCapital: number;
    riskLimitPct: number;
  } | null>(null);

  const isLoggedIn = !!user;

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isLoginCardOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (loginDropdownRef.current && !loginDropdownRef.current.contains(e.target as Node)) {
        setIsLoginCardOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isLoginCardOpen]);

  // Mobile bottom-nav tabs. Icons are names into the shared <Icon> set —
  // never emoji, so the glyphs stay crisp at any density and inherit color.
  const mobileNavTabs: MobileNavTab[] = [
    { id: 'signals', label: 'Signals', icon: 'bolt' },
    { id: 'sector-heatmap', label: 'Sectors', icon: 'bars' },
    { id: 'executions', label: 'Trades', icon: 'clipboard' },
    { id: 'analytics', label: 'P&L', icon: 'trend' },
    { id: 'settings', label: 'Settings', icon: 'gear' },
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

    if (isPaperOnly && !params.isPaperTrading) { throw new Error("Paper Mode — Orders Disabled"); }

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
      {/* ===== TOP BAR =====
           Clean top bar with brand, nav, and account actions.
           CapitalBar floats below in a separate container. */}
      <header
        className="relative"
        style={{
          backgroundColor: 'var(--ground)',
          borderBottomColor: 'var(--border-default)',
        }}
      >
        {/* Top row: brand + nav + account */}
        {/* pl-[52px] on mobile accounts for fixed hamburger button (w-10 + left-3 spacing) */}
        <div className="flex items-center h-12 pl-[52px] px-3 gap-3 lg:pl-0">
          {/* Brand — icon-only on mobile (left of header, after hamburger), full brand on desktop */}
          <div className="flex items-center shrink-0" style={{ gap: '0.5rem' }}>
            {/* Logo icon — always visible, positioned after hamburger's fixed space */}
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
            {/* Brand name — desktop only */}
            <span className="hidden lg:block font-semibold" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
              Quant Vision
            </span>
          </div>

          {/* Primary navigation */}
          <nav
            aria-label="Primary"
            className="hidden lg:flex items-center font-medium ml-4"
            style={{ gap: '1.25rem', fontSize: '13px' }}
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
                  aria-current={isActive ? 'page' : undefined}
                  className="relative cursor-pointer transition-colors py-1"
                  style={{
                    color: isActive ? 'var(--accent-brand)' : 'var(--text-secondary)',
                    fontWeight: isActive ? 600 : 500,
                  }}
                >
                  {t.label}
                  {isActive && (
                    <motion.span
                      layoutId="topnav-underline"
                      className="absolute left-0 right-0 -bottom-0.5 h-0.5 rounded-full"
                      style={{ backgroundColor: 'var(--accent-brand)' }}
                      transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right cluster: status + account */}
          <div className="flex items-center gap-2">
            {/* Status indicators — clickable for paper/live toggle */}
            <button
              onClick={() => setIsPaperOnly(!isPaperOnly)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              title={`Switch to ${isPaperOnly ? 'Live' : 'Paper'} mode`}
            >
              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className={`w-2 h-2 rounded-full shrink-0 ${isPaperOnly ? 'bg-amber-400' : 'bg-emerald-500'}`}
              />
              <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                {isPaperOnly ? 'PAPER' : 'LIVE'}
              </span>
            </button>

            {/* Zerodha status */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${isKiteLive ? 'bg-emerald-400' : 'bg-slate-300'}`} />
              <span className="text-[11px] font-medium whitespace-nowrap hidden sm:block" style={{ color: 'var(--text-secondary)' }}>
                {isKiteLive ? 'Kite' : 'yfinance'}
              </span>
            </div>

            {/* Divider */}
            <div className="w-px h-5 shrink-0" style={{ backgroundColor: 'var(--border-subtle)' }} />

            {/* Account — sign in button or avatar */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsLoginCardOpen(!isLoginCardOpen)}
                  className="flex items-center gap-2 cursor-pointer transition-colors rounded-lg shrink-0"
                  style={{
                    padding: 'clamp(0.25rem, 0.6cqi, 0.4rem) clamp(0.4rem, 1cqi, 0.6rem)',
                    fontSize: 'var(--topbar-text)',
                  }}
                  aria-label="Account menu"
                  aria-expanded={isLoginCardOpen}
                >
                  {/* User avatar with initials */}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'var(--accent-brand)' }}
                  >
                    <span className="text-[11px] font-bold" style={{ color: '#fff' }}>
                      {(profile?.full_name?.[0] || user.email?.[0] || 'U').toUpperCase()}
                    </span>
                  </div>
                  <span className="text-xs font-medium hidden sm:block" style={{ color: 'var(--text-primary)' }}>
                    {profile?.full_name?.split(' ')[0] || user.email?.split('@')[0]}
                  </span>
                  <svg className="w-3 h-3 hidden sm:block" style={{ color: 'var(--text-tertiary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {/* Dropdown */}
                {isLoginCardOpen && (
                  <div
                    ref={loginDropdownRef}
                    className="absolute right-0 top-full mt-1 w-52 rounded-xl border shadow-lg overflow-hidden"
                    style={{
                      backgroundColor: 'var(--elevated-1)',
                      borderColor: 'var(--border-default)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                      minWidth: '200px',
                      zIndex: 9999,
                    }}
                  >
                    <div className="px-3 py-2.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                      <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                        {profile?.full_name || user.email}
                      </p>
                      <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>
                        {user.email}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        setIsLoginCardOpen(false);
                        await signOut();
                        toast.success('Signed out successfully');
                      }}
                      className="w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors hover:bg-[color:var(--card-bg-hover)] cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--elevated-2)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                          <polyline points="16 17 21 12 16 7"/>
                          <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Sign out</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Log out of your account</p>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-1.5 font-semibold rounded-lg cursor-pointer transition-all whitespace-nowrap shrink-0"
                style={{
                  backgroundColor: 'var(--accent-brand)',
                  color: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                  padding: 'clamp(0.25rem, 0.6cqi, 0.4rem) clamp(0.5rem, 1.2cqi, 0.65rem)',
                  fontSize: 'var(--topbar-text)',
                }}
              >
                Sign in
              </button>
            )}
          </div>
        </div>

          {/* Determinate scan progress — hairline along the bar's bottom edge. */}
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

        {/* Floating CapitalBar row — below top bar, above content. Only on signals tab. */}
        {user && activeTab === 'signals' && (
          <div className="flex items-center justify-center px-4 py-2 border-b" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--ground)' }}>
            <CapitalBar isLoggedIn={isLoggedIn} isPaperMode={isPaperOnly} />
          </div>
        )}

        {/* ===== BODY: 100vh - 60px, flex row, sidebar + main (no full-page scroll). ===== */}
      <div className="kite-body">
        {/* Left pane — Kite sidebar. Only on signals tab. */}
        {activeTab === 'signals' && (
          <MobileSidebarDrawer>
            <Sidebar activeTab={activeTab} />
          </MobileSidebarDrawer>
        )}

        {/* Main pane — fluid width, scrolls independently. */}
        <main className="kite-main">
            {/* Tab Body View */}
            {activeTab === 'signals' && (
              <>
                {/* Heading row (page title + subtitle). */}
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

                {/* Metrics Overview Strip
              <>
                {/* Metrics Overview Strip — hairline-bordered tiles. Label reads
                    first, value second at a restrained size, and a short brand
                    tick anchors each tile so the numbers no longer float in
                    unbalanced whitespace. Values count up on change. */}
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

                {/* Strategy Rules Accordion Card — collapsed by default so the
                    UI stays lean; users tap the header to read the full rule set. */}
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
                    {/* Strategy metadata strip — clean info row at the top */}
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
              </>
            )}

            {/* Signals Tab */}
            {activeTab === 'signals' && (
              <>
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
                  {isScanning ? (
                    <div
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 py-8"
                      role="status"
                      aria-live="polite"
                      aria-label={`Scanning stocks, ${progress.percent}% complete`}
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
                            onOpenExecuteModal={(stk) => setSelectedStockForExecute(stk)}
                            isPaperOnly={isPaperOnly}
                          />
                        ))}
                      </div>
                    </AnimatePresence>
                  )}

                  {isScanning && <></>}

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
              </>
            )}

            {/* Sector Heatmap Tab */}
            {activeTab === 'sector-heatmap' && <SectorStrengthExplorer />}

            {/* Executions Tab */}
            {activeTab === 'executions' && (
              <ExecutionTracker
                key={isLoggedIn ? 'authed' : 'guest'}
                isLoggedIn={isLoggedIn}
              />
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <PnLAnalytics
                key={isLoggedIn ? 'authed' : 'guest'}
                isLoggedIn={isLoggedIn}
                onLoginClick={() => setIsZerodhaModalOpen(true)}
              />
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <SettingsPage
                key={isLoggedIn ? 'authed' : 'guest'}
                isLoggedIn={isLoggedIn}
                onLoginClick={() => setIsAuthModalOpen(true)}
              />
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
          isPaperTrading={isPaperOnly || (profile?.paper_trading_enabled ?? true)}
        />

        {/* Auth Modal */}
        {isAuthModalOpen && (
          <AuthPage onClose={() => setIsAuthModalOpen(false)} onZerodhaClick={() => setIsZerodhaModalOpen(true)} />
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

