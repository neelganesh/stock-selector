import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { authFetchJSON, APIError } from '../lib/authFetch';
import { supabase } from '../lib/supabase';

interface CapitalData {
  totalCapital: number;
  availableMargin: number;
  deployedCapital: number;
  availableCapital: number;
  riskUsed: number;
  riskUsedPct: number;
  openPositionsCount: number;
  paperTrading: boolean;
  paperTradingCapital: number;
  paperDeployedCapital: number;
  paperAvailableCapital: number;
  paperRiskUsed: number;
  paperRiskUsedPct: number;
  paperOpenPositionsCount: number;
  riskLimits: {
    riskPerTradePct: number;
    maxPositionPct: number;
    maxSectorPct: number;
    maxDailyLossPct: number;
  };
  kiteStatus?: 'connected' | 'expired' | 'token_needed' | 'not_configured';
  kiteExpiresAt?: string | null;
}

interface CapitalBarProps {
  isLoggedIn: boolean;
  isPaperMode?: boolean;
}

export function CapitalBar({ isLoggedIn, isPaperMode = false }: CapitalBarProps) {
  const [capitalData, setCapitalData] = useState<CapitalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const fetchCapitalData = useCallback(async () => {
    if (!isLoggedIn || !supabase) {
      setCapitalData(null);
      setIsLoading(false);
      return;
    }

    // Wait for session to be available (auth state might still be restoring)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      // Session not ready yet - just show loading, don't error
      setIsLoading(true);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const data = await authFetchJSON<CapitalData>('/api/capital');
      setCapitalData(data);
    } catch (err) {
      if (err instanceof APIError && (err.code === 'AUTH_FAILED' || err.status === 401)) {
        setError('Session expired - please refresh');
      } else {
        setError('Failed to load');
      }
    } finally {
      setIsLoading(false);
    }
  }, [isLoggedIn]);

  // Initial fetch with small delay to ensure auth session is ready
  useEffect(() => {
    const timer = setTimeout(fetchCapitalData, 100);
    return () => clearTimeout(timer);
  }, [fetchCapitalData]);

  // Refetch on auth state change (session restored)
  useEffect(() => {
    if (!supabase || !isLoggedIn) return;
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchCapitalData();
      }
    });
    
    return () => subscription.unsubscribe();
  }, [isLoggedIn, fetchCapitalData]);

  // Periodic refresh every 30 seconds
  useEffect(() => {
    if (!isLoggedIn) return;
    const interval = setInterval(fetchCapitalData, 30000);
    return () => clearInterval(interval);
  }, [isLoggedIn, fetchCapitalData]);

  const formatCompact = (value: number) => {
    if (value >= 1e7) return `₹${(value / 1e7).toFixed(1)}Cr`;
    if (value >= 1e5) return `₹${(value / 1e5).toFixed(1)}L`;
    if (value >= 1e3) return `₹${(value / 1e3).toFixed(1)}K`;
    return `₹${value.toFixed(0)}`;
  };

  // Guest state
  if (!isLoggedIn) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
        <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap">
          Sign in for capital
        </span>
      </div>
    );
  }

  // Loading skeleton
  if (isLoading && !capitalData) {
    return (
      <div className="flex items-center gap-3">
        <div className="w-16 h-5 rounded animate-pulse bg-slate-200" />
        <div className="w-24 h-5 rounded animate-pulse bg-slate-200" />
      </div>
    );
  }

  // Error state
  if (!capitalData) {
    return (
      <motion.button
        onClick={fetchCapitalData}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-slate-100"
        style={{ color: 'var(--negative)', backgroundColor: 'color-mix(in srgb, var(--negative) 8%, transparent)' }}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {error || 'Retry'}
      </motion.button>
    );
  }

  const { totalCapital, availableMargin, deployedCapital, availableCapital, riskUsedPct, openPositionsCount, paperTradingCapital, paperDeployedCapital, paperAvailableCapital, paperRiskUsedPct, paperOpenPositionsCount, riskLimits } = capitalData;

  // Use paper or live data based on mode
  const displayCapital = isPaperMode ? paperTradingCapital : totalCapital;
  const displayAvailableMargin = isPaperMode ? paperAvailableCapital : availableMargin;
  const displayDeployedCapital = isPaperMode ? paperDeployedCapital : deployedCapital;
  const displayAvailableCapital = isPaperMode ? paperAvailableCapital : availableCapital;
  const displayRiskUsedPct = isPaperMode ? paperRiskUsedPct : riskUsedPct;
  const displayOpenPositionsCount = isPaperMode ? paperOpenPositionsCount : openPositionsCount;
  const deployedPct = displayCapital > 0 ? (displayDeployedCapital / displayCapital) * 100 : 0;
  const isLive = !isPaperMode;

  return (
    <div className="relative">
      {/* Collapsed Bar */}
      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.995 }}
        className="group relative flex items-center gap-3 px-4 py-2 rounded-xl bg-white/80 backdrop-blur-sm border border-slate-200/80 hover:border-slate-300 hover:bg-white transition-all cursor-pointer shadow-sm"
      >
        {/* Status Dot */}
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-amber-400'}`}
        />
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {isLive ? 'LIVE' : 'PAPER'}
        </span>

        {/* Kite Status Indicator */}
        {capitalData?.kiteStatus && (
          <>
            <div className="w-px h-4 bg-slate-200" />
            <div className="flex items-center gap-1">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  capitalData.kiteStatus === 'connected' ? 'bg-emerald-500' :
                  capitalData.kiteStatus === 'expired' ? 'bg-amber-500' :
                  capitalData.kiteStatus === 'token_needed' ? 'bg-orange-500' : 'bg-slate-300'
                }`}
              />
              <span className={`text-[10px] font-semibold ${
                capitalData.kiteStatus === 'connected' ? 'text-emerald-600' :
                capitalData.kiteStatus === 'expired' ? 'text-amber-600' :
                capitalData.kiteStatus === 'token_needed' ? 'text-orange-600' : 'text-slate-400'
              }`}>
                {capitalData.kiteStatus === 'connected' ? 'Kite' :
                 capitalData.kiteStatus === 'expired' ? 'Kite expired' :
                 capitalData.kiteStatus === 'token_needed' ? 'Kite token' : 'yfinance'}
              </span>
            </div>
          </>
        )}

        {/* Divider */}
        <div className="w-px h-4 bg-slate-200" />

        {/* Capital Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-slate-800">{formatCompact(displayCapital)}</span>
            <span className="text-xs text-slate-400">total</span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="hidden sm:flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1">
            <span className="text-slate-400">·</span>
            <span className={`font-semibold ${deployedPct > 80 ? 'text-red-500' : deployedPct > 50 ? 'text-amber-600' : 'text-slate-600'}`}>
              {deployedPct.toFixed(0)}% deployed
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-400">·</span>
            <span className={`font-semibold ${riskUsedPct > riskLimits.riskPerTradePct ? 'text-red-500' : 'text-slate-500'}`}>
              {displayOpenPositionsCount} pos
            </span>
          </div>
        </div>

        {/* Expand Arrow */}
        <motion.svg
          className="w-4 h-4 text-slate-400"
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </motion.svg>
      </motion.button>

      {/* Expanded Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-full left-0 right-0 mt-2 z-50"
          >
            <GlassCard variant="elevated" padding="md" className="shadow-lg shadow-slate-200/50">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-amber-400'}`}
                    />
                    <h3 className="text-sm font-bold text-slate-800">Capital Overview</h3>
                    {isPaperMode && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 rounded">PAPER</span>
                    )}
                  </div>
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Capital Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100/50">
                    <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Total</div>
                    <div className="text-sm font-bold text-slate-800">{formatCompact(displayCapital)}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-100/50">
                    <div className="text-[10px] font-medium text-amber-600 uppercase tracking-wide mb-1">Deployed</div>
                    <div className="text-sm font-bold text-amber-700">{formatCompact(displayDeployedCapital)}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-100/50">
                    <div className="text-[10px] font-medium text-emerald-600 uppercase tracking-wide mb-1">Available</div>
                    <div className="text-sm font-bold text-emerald-700">{formatCompact(displayAvailableCapital)}</div>
                  </div>
                </div>

                {/* Progress Bars */}
                <div className="space-y-2.5">
                  {/* Deployment */}
                  <div>
                    <div className="flex justify-between text-[11px] mb-1.5">
                      <span className="text-slate-500">Deployment</span>
                      <span className={`font-semibold ${deployedPct > 80 ? 'text-red-500' : deployedPct > 50 ? 'text-amber-600' : 'text-slate-600'}`}>
                        {deployedPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(deployedPct, 100)}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className={`h-full rounded-full ${deployedPct > 80 ? 'bg-red-400' : deployedPct > 50 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                      />
                    </div>
                  </div>

                  {/* Risk */}
                  <div>
                    <div className="flex justify-between text-[11px] mb-1.5">
                      <span className="text-slate-500">Risk</span>
                      <span className={`font-semibold ${displayRiskUsedPct > riskLimits.riskPerTradePct ? 'text-red-500' : 'text-slate-600'}`}>
                        {displayRiskUsedPct.toFixed(1)}% / {riskLimits.riskPerTradePct}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((displayRiskUsedPct / riskLimits.riskPerTradePct) * 100, 100)}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className={`h-full rounded-full ${displayRiskUsedPct > riskLimits.riskPerTradePct ? 'bg-red-400' : 'bg-blue-400'}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Margin & Positions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="text-[11px] text-slate-500">
                    {isPaperMode ? 'Paper Positions' : 'Live Margin'}
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="font-semibold text-slate-700">{formatCompact(displayAvailableMargin)}</span>
                    <span className="text-slate-300">·</span>
                    <span className="font-semibold text-slate-700">{displayOpenPositionsCount} open</span>
                  </div>
                </div>

                {/* Refresh */}
                <button
                  onClick={fetchCapitalData}
                  disabled={isLoading}
                  className="w-full py-2 rounded-lg text-[11px] font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                >
                  <motion.svg
                    className="w-3.5 h-3.5"
                    animate={{ rotate: isLoading ? 360 : 0 }}
                    transition={{ duration: 1, repeat: isLoading ? Infinity : 0, ease: 'linear' }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </motion.svg>
                  {isLoading ? 'Updating...' : 'Refresh'}
                </button>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}