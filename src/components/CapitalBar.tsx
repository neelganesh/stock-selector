import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './GlassCard';

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
}

interface CapitalBarProps {
  isLoggedIn: boolean;
  onLoginClick: () => void;
}

export function CapitalBar({ isLoggedIn, onLoginClick }: CapitalBarProps) {
  const [capitalData, setCapitalData] = useState<CapitalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPaperTrading, setShowPaperTrading] = useState(false);

  const fetchCapitalData = async () => {
    if (!isLoggedIn) {
      setCapitalData(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/capital');
      if (!response.ok) {
        if (response.status === 401) {
          setError('Please login to Zerodha');
        } else {
          throw new Error('Failed to fetch capital data');
        }
        return;
      }
      const data = await response.json();
      setCapitalData(data);
      setError(null);
    } catch (err) {
      console.error('Capital fetch error:', err);
      setError('Failed to load capital data');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePaperTrading = () => {
    setShowPaperTrading(prev => !prev);
  };

  useEffect(() => {
    fetchCapitalData();
    // Poll every 30 seconds for live updates
    const interval = setInterval(fetchCapitalData, 30000);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCompact = (value: number) => {
    if (value >= 1e7) return `₹${(value / 1e7).toFixed(1)}Cr`;
    if (value >= 1e5) return `₹${(value / 1e5).toFixed(1)}L`;
    if (value >= 1e3) return `₹${(value / 1e3).toFixed(1)}K`;
    return `₹${value.toFixed(0)}`;
  };

  if (!isLoggedIn) {
    return (
      <motion.button
        onClick={onLoginClick}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-bold shadow-lg shadow-orange-500/30 transition-all cursor-pointer"
      >
        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        <span>Connect Zerodha</span>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </motion.button>
    );
  }

  if (isLoading && !capitalData) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/60 border border-slate-200/80">
        <div className="w-24 h-6 rounded bg-slate-200 animate-pulse" />
        <div className="w-20 h-6 rounded bg-slate-200 animate-pulse" />
      </div>
    );
  }

  if (!capitalData) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-medium cursor-pointer"
        onClick={fetchCapitalData}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>{error || 'Click to load capital data'}</span>
      </motion.div>
    );
  }

  const { 
    totalCapital, 
    availableMargin, 
    deployedCapital, 
    availableCapital, 
    riskUsed, 
    riskUsedPct, 
    openPositionsCount, 
    paperTrading, 
    paperTradingCapital,
    paperDeployedCapital,
    paperAvailableCapital,
    paperRiskUsed,
    paperRiskUsedPct,
    paperOpenPositionsCount,
    riskLimits 
  } = capitalData;

  const isPaperMode = showPaperTrading && paperTrading;
  
  const displayCapital = isPaperMode ? paperTradingCapital : totalCapital;
  const displayAvailableMargin = isPaperMode ? paperAvailableCapital : availableMargin;
  const displayDeployedCapital = isPaperMode ? paperDeployedCapital : deployedCapital;
  const displayAvailableCapital = isPaperMode ? paperAvailableCapital : availableCapital;
  const displayRiskUsed = isPaperMode ? paperRiskUsed : riskUsed;
  const displayRiskUsedPct = isPaperMode ? paperRiskUsedPct : riskUsedPct;
  const displayOpenPositionsCount = isPaperMode ? paperOpenPositionsCount : openPositionsCount;
  
  const deployedPct = displayCapital > 0 ? (displayDeployedCapital / displayCapital) * 100 : 0;

  return (
    <div className="relative">
      {/* Collapsed Bar */}
      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="w-full sm:w-auto min-w-[280px] flex items-center gap-3 px-4 py-2.5 rounded-xl vision-glass border border-slate-200/80 shadow-lg transition-all cursor-pointer group"
      >
        {/* Status Indicator */}
        <div className="flex items-center gap-1.5">
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className={`w-2.5 h-2.5 rounded-full ${isPaperMode ? 'bg-amber-400' : paperTrading ? 'bg-amber-400' : 'bg-emerald-500'}`}
          />
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            {isPaperMode ? 'PAPER' : paperTrading ? 'PAPER' : 'LIVE'}
          </span>
          {paperTrading && (
            <button
              onClick={togglePaperTrading}
              className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full transition-all ${
                isPaperMode 
                  ? 'bg-amber-100 text-amber-800' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {isPaperMode ? 'PAPER' : 'LIVE'}
            </button>
          )}
        </div>

        {/* Capital Summary */}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-900 truncate">{formatCompact(totalCapital)}</span>
            <span className="text-slate-400 font-medium">/</span>
            <span className="font-semibold text-emerald-700 truncate">{formatCompact(availableCapital)} avail</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className={`font-bold ${deployedPct > 80 ? 'text-red-600' : deployedPct > 50 ? 'text-amber-600' : 'text-slate-600'}`}>
              {deployedPct.toFixed(0)}% deployed
            </span>
            <span className="text-slate-400">•</span>
            <span className={`font-bold ${riskUsedPct > riskLimits.riskPerTradePct ? 'text-red-600' : 'text-slate-600'}`}>
              Risk: {riskUsedPct.toFixed(1)}%
            </span>
            <span className="text-slate-400">•</span>
            <span className="font-medium text-slate-500">{displayOpenPositionsCount} pos</span>
          </div>
        </div>

        {/* Margin Indicator */}
        <div className="flex flex-col items-end gap-0.5 text-right hidden sm:block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Margin</span>
          <span className="font-bold text-slate-900 text-sm">{formatCompact(availableMargin)}</span>
        </div>

        {/* Expand Arrow */}
        <motion.svg
          className="w-4 h-4 text-slate-400 shrink-0"
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
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute top-full left-0 right-0 mt-2 z-50"
          >
            <GlassCard variant="elevated" padding="lg" className="w-full sm:w-80 lg:w-96">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isPaperMode ? 'bg-amber-400' : paperTrading ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                    Capital Overview {isPaperMode && <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded">PAPER</span>}
                  </h3>
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Main Capital Bars */}
                <div className="space-y-3">
                  {/* Total Capital */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-600">Total Capital</span>
                      <span className="font-bold text-slate-900">{formatCurrency(displayCapital)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: '100%' }}
                        className="h-full bg-gradient-to-r from-slate-500 to-slate-700 rounded-full"
                      />
                    </div>
                  </div>

                  {/* Deployed Capital */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-600">Deployed</span>
                      <span className="font-bold text-amber-600">{formatCurrency(displayDeployedCapital)} ({deployedPct.toFixed(1)}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(deployedPct, 100)}%` }}
                        className={`h-full rounded-full ${deployedPct > 80 ? 'bg-red-500' : deployedPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      />
                    </div>
                  </div>

                  {/* Available Capital */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-600">Available</span>
                      <span className="font-bold text-emerald-700">{formatCurrency(displayAvailableCapital)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${displayCapital > 0 ? (displayAvailableCapital / displayCapital) * 100 : 0}%` }}
                        className="h-full bg-emerald-500 rounded-full"
                      />
                    </div>
                  </div>

                  {/* Risk Used */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-600">Risk Used</span>
                      <span className={`font-bold ${displayRiskUsedPct > riskLimits.riskPerTradePct ? 'text-red-600' : 'text-slate-600'}`}>
                        {formatCurrency(displayRiskUsed)} ({displayRiskUsedPct.toFixed(1)}% / {riskLimits.riskPerTradePct}% limit)
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((displayRiskUsedPct / riskLimits.riskPerTradePct) * 100, 100)}%` }}
                        className={`h-full rounded-full ${displayRiskUsedPct > riskLimits.riskPerTradePct ? 'bg-red-500' : 'bg-blue-500'}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-slate-200/60" />

                {/* Live Margin */}
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-600">
                    {isPaperMode ? 'Paper Available Capital' : 'Zerodha Available Margin'}
                  </span>
                  <span className="font-bold text-slate-900">{formatCurrency(displayAvailableMargin)}</span>
                </div>

                {/* Risk Limits */}
                <div className="border-t border-slate-200/60 pt-3 space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Risk Limits</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-slate-50/50">
                      <span className="text-slate-400 block">Per Trade</span>
                      <span className="font-bold text-slate-900">{riskLimits.riskPerTradePct}%</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50/50">
                      <span className="text-slate-400 block">Max Position</span>
                      <span className="font-bold text-slate-900">{riskLimits.maxPositionPct}%</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50/50">
                      <span className="text-slate-400 block">Max Sector</span>
                      <span className="font-bold text-slate-900">{riskLimits.maxSectorPct}%</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50/50">
                      <span className="text-slate-400 block">Daily Loss</span>
                      <span className="font-bold text-slate-900">{riskLimits.maxDailyLossPct}%</span>
                    </div>
                  </div>
                </div>

                {/* Refresh Button */}
                <button
                  onClick={fetchCapitalData}
                  disabled={isLoading}
                  className="w-full py-2 px-3 rounded-xl text-xs font-bold text-slate-700 bg-white/70 hover:bg-white border border-slate-200 transition-all flex items-center justify-center gap-2"
                >
                  <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Refresh</span>
                </button>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}