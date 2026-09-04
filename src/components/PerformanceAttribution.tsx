import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { AnimatedNumber } from './AnimatedNumber';
import {
  bucketByMonth,
  bucketByQuarter,
  bucketByFinancialYear,
  type AttributionItem,
  type AttributionBucket,
} from '../utils/attribution';

export type AttributionView = 'month' | 'quarter' | 'fy';

export interface PerformanceAttributionProps {
  isLoggedIn: boolean;
  items: AttributionItem[];
  /** Initial view. Defaults to "month". */
  defaultView?: AttributionView;
  /** Loading state. */
  isLoading?: boolean;
}

const formatINR = (value: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPct = (value: number): string => `${value.toFixed(1)}%`;

const TABS: Array<{ key: AttributionView; label: string }> = [
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'fy', label: 'FY' },
];

export function PerformanceAttribution({
  isLoggedIn,
  items,
  defaultView = 'month',
  isLoading = false,
}: PerformanceAttributionProps) {
  const [view, setView] = useState<AttributionView>(defaultView);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const buckets = useMemo<AttributionBucket[]>(() => {
    switch (view) {
      case 'month':
        return bucketByMonth(items);
      case 'quarter':
        return bucketByQuarter(items);
      case 'fy':
        return bucketByFinancialYear(items);
    }
  }, [view, items]);

  const summary = useMemo(() => {
    if (buckets.length === 0) {
      return { netPnl: 0, tradeCount: 0, winRate: 0, best: null as AttributionBucket | null, worst: null as AttributionBucket | null };
    }
    let netPnl = 0;
    let win = 0;
    let total = 0;
    for (const b of buckets) {
      netPnl += b.netPnl;
      win += b.winCount;
      total += b.tradeCount;
    }
    const winRate = total > 0 ? (win / total) * 100 : 0;
    const sorted = [...buckets].sort((a, b) => b.netPnl - a.netPnl);
    return {
      netPnl,
      tradeCount: total,
      winRate,
      best: sorted[0] ?? null,
      worst: sorted[sorted.length - 1] ?? null,
    };
  }, [buckets]);

  if (!isLoggedIn) {
    return (
      <GlassCard variant="default" padding="lg" className="text-center">
        <p className="text-slate-500 mb-2">Performance Attribution</p>
        <p className="text-sm text-slate-400">Login to view monthly/quarterly attribution.</p>
      </GlassCard>
    );
  }

  if (isLoading) {
    return (
      <GlassCard variant="default" padding="lg">
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard variant="default" padding="none" className="overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200/60">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-extrabold text-slate-900">Performance Attribution</h3>
          <div className={`text-sm font-extrabold ${summary.netPnl >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {summary.netPnl >= 0 ? '+' : '−'}
            <AnimatedNumber value={Math.abs(summary.netPnl)} format={formatINR} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-slate-50/50 border border-slate-200/60">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setView(tab.key); setExpandedKey(null); }}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                view === tab.key
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="px-4 py-3 border-b border-slate-200/60 bg-slate-50/30 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Trades</p>
          <p className="font-extrabold text-slate-900">{summary.tradeCount}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Win Rate</p>
          <p className="font-extrabold text-slate-900">{formatPct(summary.winRate)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Net P&L</p>
          <p className={`font-extrabold ${summary.netPnl >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {summary.netPnl >= 0 ? '+' : '−'}
            <AnimatedNumber value={Math.abs(summary.netPnl)} format={formatINR} />
          </p>
        </div>
      </div>

      {/* Best / Worst period callouts */}
      {summary.best && summary.worst && summary.best.key !== summary.worst.key && (
        <div className="px-4 py-3 border-b border-slate-200/60 grid grid-cols-2 gap-3">
          <div className="rounded-lg p-2 bg-emerald-50 border border-emerald-200/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Best Period</p>
            <p className="text-sm font-extrabold text-emerald-900">{summary.best.label}</p>
            <p className="text-xs text-emerald-700">+{formatINR(summary.best.netPnl)}</p>
          </div>
          <div className="rounded-lg p-2 bg-rose-50 border border-rose-200/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Worst Period</p>
            <p className="text-sm font-extrabold text-rose-900">{summary.worst.label}</p>
            <p className="text-xs text-rose-700">−{formatINR(Math.abs(summary.worst.netPnl))}</p>
          </div>
        </div>
      )}

      {/* Bucket list */}
      <div className="divide-y divide-slate-200/60">
        {buckets.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-500">No closed trades yet.</p>
            <p className="text-xs text-slate-400 mt-1">
              Exits populate the attribution view.
            </p>
          </div>
        ) : (
          buckets.map((bucket) => {
            const isExpanded = expandedKey === bucket.key;
            const positive = bucket.netPnl >= 0;
            return (
              <div key={bucket.key} className="p-3 hover:bg-slate-50/50 transition-colors">
                <button
                  onClick={() => setExpandedKey(isExpanded ? null : bucket.key)}
                  className="w-full flex items-center gap-3"
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? 'Hide breakdown' : 'Show breakdown'}
                >
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-bold text-slate-900">{bucket.label}</p>
                    <p className="text-[10px] text-slate-400">
                      {bucket.tradeCount} {bucket.tradeCount === 1 ? 'trade' : 'trades'}
                      {' · '}
                      {bucket.winCount}W / {bucket.lossCount}L
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-extrabold ${positive ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {positive ? '+' : '−'}{formatINR(Math.abs(bucket.netPnl))}
                    </p>
                  </div>
                  <svg
                    className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                        {bucket.byStrategy.map((s) => (
                          <div
                            key={s.strategyId}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{s.strategyName}</span>
                              <span className="text-slate-400">×{s.tradeCount}</span>
                            </div>
                            <span className={`font-extrabold ${s.netPnl >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {s.netPnl >= 0 ? '+' : '−'}{formatINR(Math.abs(s.netPnl))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </GlassCard>
  );
}
