import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { GlassCard } from './GlassCard';
import { AnimatedNumber } from './AnimatedNumber';
import { SignalBadge } from './SignalBadge';
import { InfoTooltip } from './InfoTooltip';
import { Icon } from './Icon';
import type { StockPick } from '../engine/types';

const LOGO_DEV_KEY = 'pk_SGz4DyGzSNKkmEabGKmhjg';

function CompanyLogo({ ticker, size = 28 }: { ticker: string; size?: number }) {
  const tickerWithSuffix = ticker.includes('.') ? ticker : `${ticker}.NS`;
  return (
    <img
      src={`https://img.logo.dev/ticker/${tickerWithSuffix}?token=${LOGO_DEV_KEY}&size=${size}&format=webp&retina=true`}
      alt={`${ticker} logo`}
      width={size}
      height={size}
      className="rounded shrink-0 object-contain"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none';
      }}
    />
  );
}

interface StockCardProps {
  isPaperOnly?: boolean;
  stock: StockPick;
  index?: number;
  onOpenExecuteModal?: (stock: StockPick) => void;
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(value);

const formatPercent = (value: number) => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

/** A dash, not the literal word "Unknown", when the engine has no data. */
const displayValue = (value: string | undefined | null) =>
  value && value.trim() && value !== 'Unknown' ? value : '—';

/**
 * Stock pick card.
 *
 * Card anatomy (unified design system):
 *
 *   [ SYM ]  Symbol  · signal    ₹ Price  +0.62%   <- header
 *           Name / sector
 *   ─────────────────────────────────────────────  <- 1px hairline
 *   R:R 1:2.3 · Vol 1.2M · +5.1% upside   ⌄     <- sub-row
 *   [expanded: price ladder · rationale ·
 *    Execute action row]
 *
 * The expanded price section is a single labelled ladder — each level
 * (stop loss / entry / current / target 1) is its own row with its
 * marker, label, and value on the same line, so the value is shown
 * exactly once and always visually attached to its marker. No separate
 * price grid duplicates it. The Execute button is anchored at the bottom
 * of the expanded body, not inlined with the rationale heading.
 *
 * Visual language: flat opaque surface, 1px hairline, no shadow, no
 * boxes around icons or chevrons. Symbol monogram is a font. Padding,
 * font-size, and icon size all scale via cqi.
 */
export function StockCard({ stock, index = 0, onOpenExecuteModal, isPaperOnly = false }: StockCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isPositive = stock.change >= 0;
  const prefersReducedMotion = useReducedMotion();

  const risk = Math.max(0.1, stock.signalDetails.entry - stock.signalDetails.stopLoss);
  const reward = Math.max(0.1, stock.signalDetails.target1 - stock.signalDetails.entry);
  const rrRatio = (reward / risk).toFixed(2);
  const upsidePercent =
    ((stock.signalDetails.target1 - stock.currentPrice) / stock.currentPrice) * 100;

  const { currentPos, target1Pos, stopLossPos, entryPos } = useMemo(() => {
    const min = Math.min(stock.signalDetails.stopLoss, stock.currentPrice) * 0.98;
    const max = Math.max(
      stock.signalDetails.target2 || stock.signalDetails.target1,
      stock.currentPrice
    ) * 1.02;
    const range = max - min;
    const pos = (val: number) => Math.min(100, Math.max(0, ((val - min) / range) * 100));
    return {
      stopLossPos: pos(stock.signalDetails.stopLoss),
      currentPos: pos(stock.currentPrice),
      target1Pos: pos(stock.signalDetails.target1),
      entryPos: pos(stock.signalDetails.entry),
    };
  }, [stock.signalDetails, stock.currentPrice]);

  const renkoInfo = stock.signalDetails.indicators?.renko;

  // Volume / market cap is display-only — label it so the compact value is
  // readable at a glance instead of a bare number.
  const volumeText = stock.volume || stock.marketCap;
  const volumeLabel = stock.volume ? 'Vol' : 'MCap';

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: prefersReducedMotion ? 0 : 0.4,
        delay: prefersReducedMotion ? 0 : Math.min(index, 8) * 0.04,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="h-full"
    >
      <GlassCard
        variant="default"
        padding="none"
        onClick={() => setIsExpanded((v) => !v)}
        className="group relative cursor-pointer transition-colors duration-200 h-full"
      >
        {/* HEADER — company logo + name + price + chevron */}

        <div
          className="kite-card-header"
          style={{ containerType: 'inline-size', containerName: 'stock-card' }}
        >
          {/* Company logo */}
          <CompanyLogo ticker={stock.symbol} size={32} />

          {/* Left: symbol only (signal moved to sub-row for more space) */}
          <div className="min-w-0 flex-1 flex items-center">
            <h3
              className="kite-card-title truncate"
              style={{ fontSize: 'clamp(13px, 4.2cqi, 16px)' }}
            >
              {stock.symbol}
            </h3>
          </div>

          {/* Right: price + change */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <div
                className="font-mono font-extrabold text-[color:var(--text-primary)] tracking-tight leading-none tabular-nums whitespace-nowrap"
                style={{ fontSize: 'clamp(13px, 4.2cqi, 16px)' }}
              >
                <AnimatedNumber value={stock.currentPrice} format={formatPrice} />
              </div>
              <motion.div
                className={`font-bold mt-0.5 flex items-center justify-end gap-0.5 leading-none tabular-nums ${
                  isPositive
                    ? 'text-[color:var(--success-green)]'
                    : 'text-[color:var(--hazard-red)]'
                }`}
                style={{ fontSize: 'clamp(10px, 2.6cqi, 12px)' }}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                key={stock.changePercent}
              >
                <svg
                  viewBox="0 0 12 12"
                  width="1em"
                  height="1em"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d={isPositive ? 'M3 8L6 4L9 8' : 'M3 4L6 8L9 4'}
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>{formatPercent(stock.changePercent)}</span>
              </motion.div>
            </div>
          </div>
        </div>

        {/* SUB-INFO — name + sector + signal badge (moved here for more space) */}
        <div
          className="border-t border-[color:var(--card-divider)]"
          style={{ 
            padding: 'clamp(0.375rem, 1.5cqi, 0.625rem) clamp(0.875rem, 3.2cqi, 1.25rem)',
            fontSize: 'clamp(10px, 2.4cqi, 12px)' 
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[color:var(--text-tertiary)]">
                {displayValue(stock.name)}
              </p>
              {stock.sector && (
                <p className="hidden sm:block truncate text-[color:var(--text-quaternary)] mt-0.5">
                  {displayValue(stock.sector)}
                </p>
              )}
            </div>
            {/* Signal badge moved here for more horizontal space */}
            <SignalBadge type={stock.signal} size="sm" />
          </div>
        </div>


        {/* SUB-ROW — meta line + chevron, separated by 1px hairline */}
        <div
          className="flex items-center justify-between gap-4 border-t border-[color:var(--card-divider)]"
          style={{ 
            padding: 'clamp(0.375rem, 1.4cqi, 0.625rem) clamp(0.875rem, 3.2cqi, 1.25rem)',
            minHeight: 'clamp(36px, 3.4cqi + 8px, 44px)' 
          }}
        >
          {/* Left: metrics */}
          <div
            className="flex items-center gap-3 text-[color:var(--text-tertiary)] min-w-0"
            style={{ fontSize: 'clamp(10px, 2.4cqi, 12px)' }}
          >
            <span className="inline-flex items-center gap-1 shrink-0 font-medium">
              <span>R:R</span>
              <span className="font-extrabold text-[color:var(--text-primary)] tabular-nums">
                1:{rrRatio}
              </span>
              <InfoTooltip
                label="Risk to Reward"
                content="Distance from entry to stop loss vs. entry to target 1. Higher means more upside per rupee risked."
                size="sm"
              />
            </span>
            <span className="text-[color:var(--text-quaternary)] select-none">·</span>
            {volumeText && (
              <span className="hidden sm:inline-flex items-center gap-1">
                <span className="truncate text-[color:var(--text-secondary)] font-semibold">
                  {volumeLabel} {volumeText}
                </span>
              </span>
            )}
          </div>

          {/* Right: upside + chevron */}
          <div className="flex items-center gap-2 shrink-0">
            {upsidePercent > 0 && (
              <span
                className="inline-flex items-center gap-1 font-extrabold text-[color:var(--text-secondary)]"
                style={{ fontSize: 'clamp(9px, 2.2cqi, 11px)' }}
              >
                <span className="tabular-nums">+{upsidePercent.toFixed(1)}%</span>
                <InfoTooltip
                  label="Target 1 Upside"
                  content="Percent change from the current price to the strategy's first target."
                  size="sm"
                />
              </span>
            )}
            <motion.span
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="kite-card-icon text-[color:var(--text-tertiary)] group-hover:text-[color:var(--text-secondary)] shrink-0"
              aria-hidden="true"
            >
              <svg viewBox="0 0 16 16" fill="none" width="100%" height="100%">
                <path
                  d="M4 6L8 10L12 6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </motion.span>
          </div>
        </div>

        {/* Renko info row (only when present) — sits inside body with hairline above */}
        {renkoInfo && (
          <div
            className="flex items-center gap-1.5 border-t border-[color:var(--card-divider)] text-[color:var(--text-secondary)]"
            style={{ 
              padding: 'clamp(0.375rem, 1.2cqi, 0.5rem) clamp(0.875rem, 3.2cqi, 1.25rem)',
              fontSize: 'clamp(9px, 2.2cqi, 11px)' 
            }}
          >
            <span className="font-extrabold uppercase tracking-wider">
              Renko: {renkoInfo.currentTrend.toUpperCase()}
            </span>
            <span className="text-[color:var(--text-quaternary)]">·</span>
            <span className="text-[color:var(--text-tertiary)] font-semibold">
              {renkoInfo.brickSize} brick
            </span>
            {renkoInfo.isAthBreakout && (
              <span className="ml-auto font-extrabold uppercase tracking-wider text-[color:var(--text-primary)]">
                ATH Breakout
              </span>
            )}
          </div>
        )}

        {/* EXPANDED DETAIL — animation reveals below the always-visible header */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div
                className="kite-card-body space-y-5 border-t border-[color:var(--card-divider)]"
                style={{ containerType: 'inline-size', containerName: 'stock-card-body' }}
              >
                {/* Price ladder — one labelled row per level, each value shown once,
                    always connected to its marker. No duplicate price grid. */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[color:var(--text-tertiary)]">
                    <span className="inline-flex items-center gap-1 font-bold uppercase tracking-wider">
                      Price Range
                      <InfoTooltip
                        label="Price Range"
                        content="Stop loss, entry, current price, and target 1 plotted on a normalized scale so you can see where the price sits in the strategy's expected move."
                        size="sm"
                      />
                    </span>
                    <span className="text-[color:var(--text-secondary)] font-bold tabular-nums normal-case tracking-normal">
                      {rrRatio} R:R
                    </span>
                  </div>

                  <div
                    className="rounded-xl border border-[color:var(--border-subtle)] px-3 py-3 space-y-3"
                    style={{ backgroundColor: 'var(--ground-secondary)' }}
                  >
                    <LadderRow
                      label="Stop Loss"
                      markerPos={stopLossPos}
                      markerColor="var(--hazard-red)"
                      value={formatPrice(stock.signalDetails.stopLoss)}
                    />
                    <LadderRow
                      label="Entry"
                      markerPos={entryPos}
                      markerColor="var(--text-primary)"
                      value={formatPrice(stock.signalDetails.entry)}
                    />
                    <LadderRow
                      label="Current"
                      markerPos={currentPos}
                      markerColor="var(--accent-blue)"
                      value={formatPrice(stock.currentPrice)}
                    />
                    <LadderRow
                      label="Target 1"
                      markerPos={target1Pos}
                      markerColor="var(--success-green)"
                      value={formatPrice(stock.signalDetails.target1)}
                    />
                  </div>
                </div>

                {/* Target 2 — the one level the ladder does not carry. Shown
                    only when the strategy produced a second target; R:R already
                    lives in the always-visible sub-row, so nothing duplicates. */}
                {stock.signalDetails.target2 !== undefined && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <MetricCell
                      label="Target 2"
                      value={formatPrice(stock.signalDetails.target2)}
                    />
                  </div>
                )}

                {/* Rationale — full-width flow section, no nested card. */}
                <div className="space-y-2.5">
                  <div className="inline-flex items-center gap-1.5 text-[color:var(--text-secondary)] font-extrabold uppercase tracking-wider">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      aria-hidden="true"
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    Rationale
                  </div>
                  <p
                    className="leading-relaxed text-[color:var(--text-secondary)] font-medium break-words"
                    style={{ fontSize: 'clamp(11px, 2.8cqi, 13px)' }}
                  >
                    {stock.signalDetails.rationale}
                  </p>
                </div>

                {/* Anchored action row — the Execute CTA rests at the bottom of
                    the card, not inlined with a section header. */}
                {onOpenExecuteModal && (
                  <div className="pt-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenExecuteModal(stock);
                      }}
                      disabled={isPaperOnly}
                      className="w-full py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: 'var(--accent-blue)',
                        color: 'var(--accent-fg)',
                        fontSize: 'clamp(11px, 2.8cqi, 13px)',
                      }}
                    >
                      <Icon name="arrow-right" size={16} strokeWidth={2.5} />
                      {isPaperOnly ? "Paper Mode — Orders Disabled" : "Execute"}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </motion.div>
  );
}

function LadderRow({
  label,
  markerPos,
  markerColor,
  value,
}: {
  label: string;
  markerPos: number;
  markerColor: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="w-16 shrink-0 text-[10px] font-bold uppercase tracking-wider tabular-nums"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
      </span>
      <div
        className="relative h-1.5 flex-1 rounded-full"
        style={{ backgroundColor: 'var(--border-subtle)' }}
      >
        <span
          className="absolute top-1/2 w-2.5 h-2.5 rounded-full border-2 border-[color:var(--ground)]"
          style={{
            left: `${markerPos}%`,
            transform: 'translate(-50%, -50%)',
            backgroundColor: markerColor,
          }}
          aria-hidden="true"
        />
      </div>
      <span
        className="w-20 shrink-0 text-right font-mono font-extrabold tabular-nums"
        style={{ color: 'var(--text-primary)', fontSize: 'clamp(11px, 2.8cqi, 13px)' }}
      >
        {value}
      </span>
    </div>
  );
}

function MetricCell({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: string;
  tooltip?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[color:var(--text-tertiary)] font-bold uppercase tracking-wider mb-1 truncate">
        <span className="truncate">{label}</span>
        {tooltip && <InfoTooltip label={label} content={tooltip} size="sm" />}
      </div>
      <span
        className="block font-mono font-extrabold tabular-nums text-[color:var(--text-primary)] truncate"
        style={{ fontSize: 'clamp(12px, 3.2cqi, 14px)' }}
      >
        {value}
      </span>
    </div>
  );
}
