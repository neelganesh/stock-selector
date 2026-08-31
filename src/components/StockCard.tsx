import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { GlassCard } from './GlassCard';
import { AnimatedNumber } from './AnimatedNumber';
import { SignalBadge } from './SignalBadge';
import type { StockPick } from '../engine/types';

interface StockCardProps {
  stock: StockPick;
  index?: number;
  onOpenPositionCalculator?: (stock: StockPick) => void;
  onOpenExecuteModal?: (stock: StockPick) => void;
}

export function StockCard({ stock, index = 0, onOpenPositionCalculator, onOpenExecuteModal }: StockCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isPositive = stock.change >= 0;

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  // Calculate Risk to Reward ratio
  const risk = Math.max(0.1, stock.signalDetails.entry - stock.signalDetails.stopLoss);
  const reward = Math.max(0.1, stock.signalDetails.target1 - stock.signalDetails.entry);
  const rrRatio = (reward / risk).toFixed(2);

  // Target upside % from current price
  const upsidePercent = ((stock.signalDetails.target1 - stock.currentPrice) / stock.currentPrice) * 100;

  // Gauge bar position calculations
  const minPrice = Math.min(stock.signalDetails.stopLoss, stock.currentPrice) * 0.98;
  const maxPrice = Math.max(stock.signalDetails.target2 || stock.signalDetails.target1, stock.currentPrice) * 1.02;
  const priceRange = maxPrice - minPrice;
  const getPos = (val: number) => Math.min(100, Math.max(0, ((val - minPrice) / priceRange) * 100));

  const currentPos = getPos(stock.currentPrice);
  const entryPos = getPos(stock.signalDetails.entry);

  const renkoInfo = stock.signalDetails.indicators?.renko;

  return (
    <GlassCard
      variant="interactive"
      padding="none"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.08,
        ease: [0.16, 1, 0.3, 1],
      }}
      onClick={() => setIsExpanded(!isExpanded)}
      className="group relative cursor-pointer overflow-hidden transition-all duration-300"
    >
      {/* Accent glow line on top border based on signal */}
      <div
        className={`absolute top-0 left-0 right-0 h-[3px] transition-opacity duration-300 ${
          stock.signal.includes('buy')
            ? 'bg-gradient-to-r from-emerald-400 via-green-500 to-teal-400'
            : stock.signal === 'hold'
            ? 'bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-400'
            : 'bg-gradient-to-r from-rose-400 via-red-500 to-pink-500'
        }`}
      />

      {/* Main Content Viewport */}
      <div className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Symbol & Title */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center font-extrabold text-sm shadow-md shrink-0 group-hover:scale-105 transition-transform duration-300">
              {stock.symbol.slice(0, 2)}
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-extrabold text-slate-900 tracking-tight leading-none">
                  {stock.symbol}
                </h3>
                <div className="inline-flex items-center gap-2">
                  <SignalBadge type={stock.signal} size="sm" />

                  {stock.tradingSegment && (
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                        stock.tradingSegment === 'F&O Segment'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {stock.tradingSegment}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs font-semibold text-slate-500 mt-1 flex items-center gap-1.5 leading-none">
                <span>{stock.name}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300 inline-block" />
                <span className="text-slate-400">{stock.sector}</span>
              </p>
            </div>
          </div>

          {/* Price, Change & Upside Pill */}
          <div className="flex items-center justify-between sm:justify-end gap-5 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
            {/* Upside pill */}
            {upsidePercent > 0 && (
              <div className="hidden md:flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Target Upside</span>
                <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  +{upsidePercent.toFixed(1)}%
                </span>
              </div>
            )}

            <div className="text-right flex flex-col justify-center">
              <div className="text-xl sm:text-2xl font-mono font-extrabold text-slate-900 tracking-tight leading-none">
                <AnimatedNumber value={stock.currentPrice} format={formatPrice} />
              </div>
              <motion.div
                className={`text-xs font-bold mt-1.5 flex items-center justify-end gap-1 leading-none ${
                  isPositive ? 'text-emerald-700' : 'text-rose-700'
                }`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                key={stock.changePercent}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={isPositive ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                </svg>
                <span>{formatPercent(Math.abs(stock.changePercent))}</span>
              </motion.div>
            </div>

            {/* Expand Chevron */}
            <div className="w-8 h-8 rounded-full bg-slate-100/80 border border-slate-200/80 flex items-center justify-center text-slate-500 group-hover:text-slate-900 transition-colors shrink-0 self-center">
              <motion.svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <path
                  d="M4 6L8 10L12 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </motion.svg>
            </div>
          </div>
        </div>

        {/* Quick Stats Bar */}
        {(stock.volume || stock.marketCap || stock.dataSource || renkoInfo) && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 pt-3.5 border-t border-slate-200/60 text-xs">
            {stock.volume && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Vol:</span>
                <span className="font-bold text-slate-700">{stock.volume}</span>
              </div>
            )}
            {stock.marketCap && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Cap:</span>
                <span className="font-bold text-slate-700">{stock.marketCap}</span>
              </div>
            )}
            {renkoInfo && (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-800 font-bold text-xs">
                <span>Renko:</span>
                <span>{renkoInfo.currentTrend.toUpperCase()} ({renkoInfo.brickSize} Brick)</span>
                {renkoInfo.isAthBreakout && (
                  <span className="bg-purple-600 text-white px-1.5 rounded text-[9px] font-extrabold uppercase">
                    ATH BREAKOUT
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-slate-400 font-medium">R:R Ratio:</span>
              <span className="font-extrabold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200">
                1:{rrRatio}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Expanded Signal Details Drawer */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden bg-white/40 backdrop-blur-md border-t border-white/60"
          >
            <div className="p-5 sm:p-6 space-y-5">
              {/* Visual Price Range Gauge */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
                  <span>Price Target Range</span>
                  <span className="text-blue-600">Entry: {formatPrice(stock.signalDetails.entry)}</span>
                </div>

                <div className="relative h-3 w-full bg-gray-200/80 rounded-full overflow-hidden p-0.5">
                  {/* Target Zone Highlight */}
                  <div
                    className="absolute top-0 bottom-0 bg-emerald-500/20 rounded-full border-l border-r border-emerald-400"
                    style={{
                      left: `${entryPos}%`,
                      width: `${Math.max(5, getPos(stock.signalDetails.target1) - entryPos)}%`,
                    }}
                  />
                  {/* Current price marker */}
                  <div
                    className="absolute top-0 bottom-0 w-2.5 bg-blue-600 rounded-full shadow-md z-10 transition-all duration-500 -ml-1"
                    style={{ left: `${currentPos}%` }}
                    title={`Current: ${formatPrice(stock.currentPrice)}`}
                  />
                </div>

                <div className="flex justify-between text-[11px] font-medium text-gray-400">
                  <span className="text-rose-600 font-semibold">SL: {formatPrice(stock.signalDetails.stopLoss)}</span>
                  <span className="text-emerald-600 font-semibold">T1: {formatPrice(stock.signalDetails.target1)}</span>
                </div>
              </div>

              {/* Key Signal Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Entry Level</span>
                  <span className="text-sm font-mono font-extrabold text-blue-700">
                    {formatPrice(stock.signalDetails.entry)}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Stop Loss</span>
                  <span className="text-sm font-mono font-extrabold text-rose-700">
                    {formatPrice(stock.signalDetails.stopLoss)}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Target 1</span>
                  <span className="text-sm font-mono font-extrabold text-emerald-700">
                    {formatPrice(stock.signalDetails.target1)}
                  </span>
                </div>
                {stock.signalDetails.target2 && (
                  <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Target 2</span>
                    <span className="text-sm font-mono font-extrabold text-emerald-700">
                      {formatPrice(stock.signalDetails.target2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Strategy Rationale */}
              <div className="p-4 rounded-xl bg-white border border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-indigo-600">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span>Strategy Rationale & Setup</span>
                  </div>

                  {onOpenPositionCalculator && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenPositionCalculator(stock);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-98"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span>Position Calculator</span>
                    </button>
                  )}
                  {onOpenExecuteModal && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenExecuteModal(stock);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-98"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      <span>Execute Trade</span>
                    </button>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium pt-0.5">
                  {stock.signalDetails.rationale}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
