import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './GlassCard';
import type { StockPick } from '../engine/types';

interface ExecuteModalProps {
  isOpen: boolean;
  stock: StockPick | null;
  onClose: () => void;
  onExecute: (params: ExecuteParams) => Promise<void>;
  isLoggedIn: boolean;
  availableCapital: number;
  riskLimitPct: number;
  isPaperTrading?: boolean;
}

interface ExecuteParams {
  symbol: string;
  exchange: string;
  quantity: number;
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  transactionType: 'BUY' | 'SELL';
  product: 'CNC' | 'MIS';
  riskAmount: number;
  riskPct: number;
  charges: ChargeBreakdown;
  isPaperTrading?: boolean;
  sector?: string;
  name?: string;
  capCategory?: 'large' | 'mid' | 'small';
}

interface ChargeBreakdown {
  brokerage: number;
  stt: number;
  exchange: number;
  sebi: number;
  gst: number;
  stampDuty: number;
  total: number;
}

const ZERODHA_CHARGES = {
  brokeragePerOrder: 20, // ₹20 per executed order
  sttPct: 0.001, // 0.1% on sell side for delivery, 0.025% on sell side for intraday
  exchangePct: 0.0000345, // 0.00345% NSE
  sebiPct: 0.000001, // ₹1 per crore
  gstPct: 0.18, // 18% on brokerage + exchange + sebi
  stampDutyPct: 0.00015, // 0.015% on buy side
};

export function ExecuteModal({
  isOpen,
  stock,
  onClose,
  onExecute,
  isLoggedIn,
  availableCapital,
  riskLimitPct,
  isPaperTrading = false,
}: ExecuteModalProps) {
  const [riskPct, setRiskPct] = useState(2); // Default 2% risk per trade
  const [entryPrice, setEntryPrice] = useState(0);
  const [stopLoss, setStopLoss] = useState(0);
  const [target1, setTarget1] = useState(0);
  const [target2, setTarget2] = useState(0);
  const [quantity, setQuantity] = useState(0);
  const [productType, setProductType] = useState<'CNC' | 'MIS'>('CNC');
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [charges, setCharges] = useState<ChargeBreakdown>({
    brokerage: 0,
    stt: 0,
    exchange: 0,
    sebi: 0,
    gst: 0,
    stampDuty: 0,
    total: 0,
  });

  // Sync with stock signal details when stock changes
  useEffect(() => {
    if (stock) {
      setEntryPrice(stock.currentPrice);
      setStopLoss(stock.signalDetails.stopLoss);
      setTarget1(stock.signalDetails.target1);
      setTarget2(stock.signalDetails.target2 || stock.signalDetails.target1 * 1.5);
      setError(null);
    }
  }, [stock]);

  // Calculate quantity based on risk amount
  const riskAmount = useMemo(() => {
    const capital = availableCapital > 0 ? availableCapital : ((stock?.currentPrice || 100) * 1000) || 100000;
    return (capital * riskPct) / 100;
  }, [availableCapital, riskPct, stock?.currentPrice]);

  const perShareRisk = useMemo(() => {
    return Math.abs(entryPrice - stopLoss);
  }, [entryPrice, stopLoss]);

  const calculatedQuantity = useMemo(() => {
    if (perShareRisk <= 0) return 0;
    return Math.floor(riskAmount / perShareRisk);
  }, [riskAmount, perShareRisk]);

  // Update quantity when calculated quantity changes
  useEffect(() => {
    setQuantity(calculatedQuantity);
  }, [calculatedQuantity]);

  // Calculate charges
  useEffect(() => {
    if (quantity <= 0 || entryPrice <= 0) {
      setCharges({ brokerage: 0, stt: 0, exchange: 0, sebi: 0, gst: 0, stampDuty: 0, total: 0 });
      return;
    }

    const turnover = quantity * entryPrice;
    const brokerage = ZERODHA_CHARGES.brokeragePerOrder * 2; // Entry + Exit (GTT)
    const exchange = turnover * ZERODHA_CHARGES.exchangePct;
    const sebi = turnover * ZERODHA_CHARGES.sebiPct;
    const gst = (brokerage + exchange + sebi) * ZERODHA_CHARGES.gstPct;
    const stampDuty = turnover * ZERODHA_CHARGES.stampDutyPct;
    const stt = turnover * (productType === 'MIS' ? 0.00025 : 0.001); // Intraday vs Delivery

    setCharges({
      brokerage,
      stt,
      exchange,
      sebi,
      gst,
      stampDuty,
      total: brokerage + stt + exchange + sebi + gst + stampDuty,
    });
  }, [quantity, entryPrice, productType]);

  const maxRiskAmount = useMemo(() => {
    const capital = availableCapital > 0 ? availableCapital : 100000;
    return (capital * riskLimitPct) / 100;
  }, [availableCapital, riskLimitPct]);

  const handleExecute = async () => {
    if (!stock) return;
    if (!isLoggedIn && !isPaperTrading) {
      setError('Please login to Zerodha first');
      return;
    }
    if (quantity <= 0) {
      setError('Invalid quantity');
      return;
    }
    if (riskAmount > maxRiskAmount) {
      setError(`Risk amount exceeds limit of ${riskLimitPct}%`);
      return;
    }

    setIsExecuting(true);
    setError(null);

    try {
      await onExecute({
        symbol: stock.symbol.replace('.NS', ''),
        exchange: 'NSE',
        quantity,
        entryPrice,
        stopLoss,
        target1,
        target2,
        transactionType: 'BUY',
        product: productType,
        riskAmount,
        riskPct,
        charges,
        isPaperTrading,
        sector: stock.sector,
        name: stock.name,
        capCategory: stock.capCategory === 'all' ? 'large' : stock.capCategory,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

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

  if (!isOpen || !stock) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-full max-w-2xl max-h-[90vh] overflow-y-auto vision-glass rounded-3xl border border-slate-200/80 shadow-2xl"
          data-modal-panel
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-200/60 sticky top-0 bg-white/95 backdrop-blur z-10 rounded-t-3xl">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 flex items-center justify-center ${
                isPaperTrading
                  ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                  : 'bg-gradient-to-br from-emerald-500 to-emerald-600'
              }`}>
                {isPaperTrading ? (
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                )}
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  Execute Trade
                  {isPaperTrading && (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full">
                      PAPER
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded-full">
                    {stock.signal}
                  </span>
                  <span className="font-medium">{stock.name} ({stock.symbol})</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-[10px] text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--ground-secondary)] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Risk Slider Section */}
            <GlassCard variant="default" padding="md" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Risk per Trade</span>
                </h3>
                <span className="text-sm font-bold text-slate-900">{riskPct}%</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0.5"
                  max="5"
                  step="0.5"
                  value={riskPct}
                  onChange={(e) => setRiskPct(parseFloat(e.target.value))}
                  className="flex-1 h-2 bg-slate-100 rounded-lg appearance-none accent-emerald-500 cursor-pointer"
                />
                <div className="text-right w-24">
                  <p className="text-xs text-slate-500">Max: {riskLimitPct}%</p>
                  <p className="text-xs font-bold text-emerald-700">Risk: {formatCompact(riskAmount)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Conservative</span>
                <span>Moderate</span>
                <span>Aggressive</span>
              </div>
            </GlassCard>

            {/* Price Levels Section */}
            <GlassCard variant="default" padding="md" className="space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Price Levels</span>
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Entry Price</label>
                  <input
                    type="number"
                    step="0.05"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/80 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Stop Loss</label>
                  <input
                    type="number"
                    step="0.05"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/80 text-sm font-bold text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target 1</label>
                  <input
                    type="number"
                    step="0.05"
                    value={target1}
                    onChange={(e) => setTarget1(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/80 text-sm font-bold text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target 2</label>
                  <input
                    type="number"
                    step="0.05"
                    value={target2}
                    onChange={(e) => setTarget2(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/80 text-sm font-bold text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 grid grid-cols-3 gap-3 text-center">
                <div className="p-2 text-[color:var(--positive)]">
                  <p className="text-[10px] font-bold text-[color:var(--text-tertiary)]">R:R (T1)</p>
                  <p className="font-bold text-[color:var(--positive)]">
                    {entryPrice && stopLoss && target1 && entryPrice !== stopLoss
                      ? ((target1 - entryPrice) / Math.abs(entryPrice - stopLoss)).toFixed(2)
                      : '—'}
                  </p>
                </div>
                <div className="p-2 text-[color:var(--positive)]">
                  <p className="text-[10px] font-bold text-[color:var(--text-tertiary)]">R:R (T2)</p>
                  <p className="font-bold text-[color:var(--positive)]">
                    {entryPrice && stopLoss && target2 && entryPrice !== stopLoss
                      ? ((target2 - entryPrice) / Math.abs(entryPrice - stopLoss)).toFixed(2)
                      : '—'}
                  </p>
                </div>
                <div className="p-2 text-[color:var(--accent)]">
                  <p className="text-[10px] font-bold text-slate-400">Per Share Risk</p>
                  <p className="font-bold text-blue-700">{formatCurrency(perShareRisk)}</p>
                </div>
              </div>
            </GlassCard>

            {/* Position Sizing Section */}
            <GlassCard variant="default" padding="md" className="space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Position Sizing</span>
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/80 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Product Type</label>
                  <select
                    value={productType}
                    onChange={(e) => setProductType(e.target.value as 'CNC' | 'MIS')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/80 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="CNC">CNC (Delivery)</option>
                    <option value="MIS">MIS (Intraday)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center pt-2 border-t border-slate-100">
                <div className="p-2">
                  <p className="text-[10px] font-bold text-[color:var(--text-tertiary)]">Position Value</p>
                  <p className="font-bold text-[color:var(--text-primary)]">{formatCompact(quantity * entryPrice)}</p>
                </div>
                <div className="p-2">
                  <p className="text-[10px] font-bold text-[color:var(--text-tertiary)]">% of Capital</p>
                  <p className="font-bold text-[color:var(--text-primary)]">
                    {availableCapital > 0 ? ((quantity * entryPrice) / availableCapital * 100).toFixed(1) : '—'}%
                  </p>
                </div>
                <div className="p-2">
                  <p className="text-[10px] font-bold text-[color:var(--text-tertiary)]">Risk Amount</p>
                  <p className="font-bold text-[color:var(--accent)]">{formatCompact(quantity * perShareRisk)}</p>
                </div>
              </div>
            </GlassCard>

            {/* Charges Breakdown */}
            <GlassCard variant="default" padding="md" className="space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Estimated Charges (Entry + Exit)</span>
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Brokerage (₹20 × 2 orders)</span>
                  <span className="font-medium text-slate-900">{formatCurrency(charges.brokerage)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">STT</span>
                  <span className="font-medium text-slate-900">{formatCurrency(charges.stt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Exchange Charges</span>
                  <span className="font-medium text-slate-900">{formatCurrency(charges.exchange)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">SEBI Fees</span>
                  <span className="font-medium text-slate-900">{formatCurrency(charges.sebi)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">GST (18%)</span>
                  <span className="font-medium text-slate-900">{formatCurrency(charges.gst)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Stamp Duty</span>
                  <span className="font-medium text-slate-900">{formatCurrency(charges.stampDuty)}</span>
                </div>
                <div className="border-t border-slate-100 pt-2 flex justify-between">
                  <span className="font-bold text-slate-900">Total Charges</span>
                  <span className="font-bold text-emerald-700">{formatCurrency(charges.total)}</span>
                </div>
              </div>
            </GlassCard>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-[var(--card-radius)] bg-[color:var(--ground-secondary)] border border-[color:var(--negative)]/30 text-[color:var(--negative)] text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </motion.div>
            )}

            {/* Execute Button */}
            <motion.button
              onClick={handleExecute}
              disabled={isExecuting || quantity <= 0 || (!isLoggedIn && !isPaperTrading)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={`w-full py-3.5 px-5 rounded-[var(--card-radius)] text-[color:var(--accent-fg)] font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                isPaperTrading
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 shadow-orange-500/30'
                  : 'bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-emerald-500/30'
              }`}
            >
              {isExecuting ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Executing...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span>
                    {isPaperTrading
                      ? 'Paper Mode — Orders Disabled (Simulated)'
                      : 'Place Entry Order + GTT (SL + Targets)'}
                  </span>
                </>
              )}
            </motion.button>

            <p className="text-center text-[10px] text-slate-400">
              {isPaperTrading
                ? 'Paper Mode — Real orders disabled. This is a simulated trade only.'
                : 'Places market entry order + GTT OCO (Stop Loss + Target 1 + Target 2)'}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}