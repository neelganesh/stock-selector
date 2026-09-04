import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { AnimatedNumber } from './AnimatedNumber';
import {
  buildEquityCurve,
  computeDrawdowns,
  summarizeDrawdown,
  type DrawdownTrade,
} from '../utils/drawdown';

export interface DrawdownAnalysisProps {
  isLoggedIn: boolean;
  trades: DrawdownTrade[];
  startingCapital: number;
  isLoading?: boolean;
}

const formatINR = (value: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPct = (value: number): string => `${value.toFixed(2)}%`;

const formatDate = (iso: string | null): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
};

/**
 * Pure-SVG line + area chart. No external chart library.
 */
function DrawdownChart({
  curve,
  drawdowns,
  width = 640,
  height = 180,
}: {
  curve: ReturnType<typeof buildEquityCurve>;
  drawdowns: ReturnType<typeof computeDrawdowns>;
  width?: number;
  height?: number;
}) {
  const margin = { top: 12, right: 12, bottom: 24, left: 56 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  if (curve.length === 0) return null;

  const equityValues = curve.map((p) => p.equity);
  const minEquity = Math.min(...equityValues, 0);
  const maxEquity = Math.max(...equityValues, 1);
  const equityRange = maxEquity - minEquity || 1;

  // X positions: evenly spaced if only start + 1 point, else use date ordering
  const xStep = curve.length > 1 ? innerW / (curve.length - 1) : 0;
  const xAt = (i: number) => margin.left + i * xStep;
  const yAt = (eq: number) => margin.top + innerH - ((eq - minEquity) / equityRange) * innerH;

  // Equity line path
  const equityPath = curve
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(p.equity)}`)
    .join(' ');

  // Underwater area path: equity line mirrored against the peak line
  const peakPath = drawdowns
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(p.peak)}`)
    .join(' ');

  // Underwater area: from peak line down to equity line, then back along baseline
  const areaSegments: string[] = [];
  for (let i = 0; i < drawdowns.length; i++) {
    const d = drawdowns[i];
    if (d.drawdownPct < 0) {
      areaSegments.push(`${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(d.peak)}`);
    }
  }
  for (let i = drawdowns.length - 1; i >= 0; i--) {
    const d = drawdowns[i];
    if (d.drawdownPct < 0) {
      areaSegments.push(`L ${xAt(i)} ${yAt(d.equity)}`);
    }
  }
  if (areaSegments.length > 0) areaSegments.push('Z');
  const underwaterPath = areaSegments.join(' ');

  // Y-axis ticks
  const ticks = 4;
  const tickValues = Array.from({ length: ticks + 1 }, (_, i) => minEquity + (equityRange * i) / ticks);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Equity curve">
      {/* Y-axis grid + labels */}
      {tickValues.map((v, i) => {
        const y = yAt(v);
        return (
          <g key={i}>
            <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke="rgb(226 232 240)" strokeWidth={1} strokeDasharray="2,2" />
            <text x={margin.left - 6} y={y + 3} textAnchor="end" fontSize="9" fill="rgb(148 163 184)">
              {formatINR(v).replace('₹', '₹')}
            </text>
          </g>
        );
      })}

      {/* Underwater area (rose) */}
      {underwaterPath && (
        <motion.path
          d={underwaterPath}
          fill="rgb(244 63 94 / 0.18)"
          stroke="none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        />
      )}

      {/* Peak line (slate dashed) */}
      <path d={peakPath} fill="none" stroke="rgb(148 163 184)" strokeWidth={1} strokeDasharray="3,3" />

      {/* Equity line (emerald) */}
      <motion.path
        d={equityPath}
        fill="none"
        stroke="rgb(16 185 129)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />

      {/* Data points */}
      {curve.map((p, i) => (
        <circle key={i} cx={xAt(i)} cy={yAt(p.equity)} r={2.5} fill="rgb(16 185 129)" />
      ))}
    </svg>
  );
}

export function DrawdownAnalysis({ isLoggedIn, trades, startingCapital, isLoading = false }: DrawdownAnalysisProps) {
  const summary = useMemo(() => summarizeDrawdown(trades, startingCapital), [trades, startingCapital]);
  const curve = useMemo(() => buildEquityCurve(trades, startingCapital), [trades, startingCapital]);
  const drawdowns = useMemo(() => computeDrawdowns(curve), [curve]);

  if (!isLoggedIn) {
    return (
      <GlassCard variant="default" padding="lg" className="text-center">
        <p className="text-slate-500 mb-2">Drawdown Analysis</p>
        <p className="text-sm text-slate-400">Login to view equity drawdown.</p>
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

  if (summary.totalClosedTrades === 0) {
    return (
      <GlassCard variant="default" padding="lg" className="text-center">
        <p className="text-slate-500 mb-2">Drawdown Analysis</p>
        <p className="text-sm text-slate-400">No closed trades yet.</p>
        <p className="text-xs text-slate-400 mt-1">Exits populate the drawdown chart.</p>
      </GlassCard>
    );
  }

  const isRecovered = summary.recoveryDate !== null;
  const maxDD = summary.maxDrawdownPct; // negative

  return (
    <GlassCard variant="default" padding="none" className="overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200/60">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-extrabold text-slate-900">Drawdown Analysis</h3>
          <div className={`text-sm font-extrabold ${summary.finalReturnPct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {summary.finalReturnPct >= 0 ? '+' : '−'}
            <AnimatedNumber value={Math.abs(summary.finalReturnPct)} format={formatPct} /> return
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg p-2 bg-slate-50/50 border border-slate-200/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Max Drawdown</p>
            <p className={`font-extrabold ${maxDD < 0 ? 'text-rose-700' : 'text-slate-900'}`}>
              {maxDD < 0 ? '−' : '+'}
              <AnimatedNumber value={Math.abs(maxDD)} format={formatPct} />
            </p>
          </div>
          <div className="rounded-lg p-2 bg-slate-50/50 border border-slate-200/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Underwater</p>
            <p className="font-extrabold text-slate-900">{summary.longestUnderwaterDays}d</p>
          </div>
          <div className="rounded-lg p-2 bg-slate-50/50 border border-slate-200/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Closed Trades</p>
            <p className="font-extrabold text-slate-900">{summary.totalClosedTrades}</p>
          </div>
        </div>
      </div>

      {/* Equity curve chart */}
      <div className="p-4 border-b border-slate-200/60 bg-slate-50/30">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Equity Curve</p>
        <DrawdownChart curve={curve} drawdowns={drawdowns} />
      </div>

      {/* Worst drawdown episode */}
      <div className="p-4 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Worst Drawdown Episode</p>
        {summary.troughDate ? (
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <p className="text-slate-400">Peak</p>
              <p className="font-bold text-emerald-700">{formatDate(summary.peakDate)}</p>
            </div>
            <div>
              <p className="text-slate-400">Trough</p>
              <p className="font-bold text-rose-700">{formatDate(summary.troughDate)}</p>
            </div>
            <div>
              <p className="text-slate-400">Recovery</p>
              <p className={`font-bold ${isRecovered ? 'text-emerald-700' : 'text-amber-700'}`}>
                {isRecovered ? formatDate(summary.recoveryDate) : 'Open'}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No drawdown recorded — equity has been monotonically increasing.</p>
        )}
      </div>
    </GlassCard>
  );
}
