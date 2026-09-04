import React, { useState, useEffect } from 'react';
import type { StockPick } from '../engine/types';

interface PositionSizingModalProps {
  isOpen?: boolean;
  stock?: StockPick | null;
  pick?: StockPick | null;
  onClose: () => void;
}

export const PositionSizingModal: React.FC<PositionSizingModalProps> = ({
  isOpen = true,
  stock: inputStock,
  pick: inputPick,
  onClose,
}) => {
  const pick = inputStock || inputPick;
  const [totalCapital, setTotalCapital] = useState<number>(500000); // Default ₹5 Lakh
  const [riskPercent, setRiskPercent] = useState<number>(1.0); // Default 1% risk per trade

  const defaultEntry = pick?.signalDetails?.entry ?? pick?.currentPrice ?? 100;
  const defaultSl = pick?.signalDetails?.stopLoss ?? (pick?.currentPrice ? Number((pick.currentPrice * 0.95).toFixed(2)) : 95);

  const [customEntry, setCustomEntry] = useState<number>(defaultEntry);
  const [customSl, setCustomSl] = useState<number>(defaultSl);

  // Sync state whenever pick changes or modal opens
  useEffect(() => {
    if (pick) {
      setCustomEntry(pick.signalDetails?.entry ?? pick.currentPrice ?? 100);
      setCustomSl(pick.signalDetails?.stopLoss ?? (pick.currentPrice ? Number((pick.currentPrice * 0.95).toFixed(2)) : 95));
    }
  }, [pick?.symbol, pick?.signalDetails?.entry, pick?.signalDetails?.stopLoss, isOpen]);

  if (!isOpen || !pick) return null;

  const entryPrice = customEntry > 0 ? customEntry : defaultEntry;
  const stopLossPrice = customSl > 0 ? customSl : defaultSl;

  const isValidSl = stopLossPrice < entryPrice;
  const riskPerShare = isValidSl ? Math.max(0.01, entryPrice - stopLossPrice) : 0;
  const slPercent = entryPrice > 0 && isValidSl ? ((entryPrice - stopLossPrice) / entryPrice) * 100 : 0;

  const maxAllowedRiskAmount = (totalCapital * riskPercent) / 100;
  const calculatedShares = isValidSl && riskPerShare > 0 ? Math.floor(maxAllowedRiskAmount / riskPerShare) : 0;
  const totalInvestmentRequired = calculatedShares * entryPrice;
  const capitalExposurePercent = totalCapital > 0 ? (totalInvestmentRequired / totalCapital) * 100 : 0;

  // Targets & Upside
  const target1 = pick.signalDetails.target1;
  const target1UpsidePx = Math.max(0, target1 - entryPrice);
  const target1UpsidePct = entryPrice > 0 ? (target1UpsidePx / entryPrice) * 100 : 0;
  const target1Profit = calculatedShares * target1UpsidePx;
  const rr1 = riskPerShare > 0 ? (target1UpsidePx / riskPerShare) : 0;

  const target2 = pick.signalDetails.target2;
  const target2UpsidePx = target2 ? Math.max(0, target2 - entryPrice) : 0;
  const target2UpsidePct = target2 && entryPrice > 0 ? (target2UpsidePx / entryPrice) * 100 : 0;
  const target2Profit = target2 ? calculatedShares * target2UpsidePx : 0;
  const rr2 = target2 && riskPerShare > 0 ? (target2UpsidePx / riskPerShare) : 0;

  const handleResetToSignal = () => {
    setCustomEntry(pick.signalDetails.entry);
    setCustomSl(pick.signalDetails.stopLoss);
  };

  const handleSetEntryToCmp = () => {
    setCustomEntry(pick.currentPrice);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200" data-modal-panel>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Risk Management Engine
              </span>
              <span className="text-xs font-semibold text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded bg-amber-500/10">
                [{pick.tradingSegment}]
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">
              Position Sizing Calculator — {pick.symbol}
            </h2>
            <p className="text-xs text-slate-400">{pick.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Market & Signal Details Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-xs">
            <div>
              <div className="text-slate-500 text-[10px] font-semibold uppercase">Live CMP</div>
              <div className="font-bold text-white font-mono mt-0.5">₹{pick.currentPrice.toFixed(2)}</div>
              <div className={`text-[10px] font-semibold ${pick.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {pick.changePercent >= 0 ? '+' : ''}{pick.changePercent.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-[10px] font-semibold uppercase">Signal Entry</div>
              <div className="font-bold text-emerald-400 font-mono mt-0.5">₹{pick.signalDetails.entry.toFixed(2)}</div>
              <div className="text-[10px] text-slate-400">Strategy Level</div>
            </div>
            <div>
              <div className="text-slate-500 text-[10px] font-semibold uppercase">Signal Stop-Loss</div>
              <div className="font-bold text-rose-400 font-mono mt-0.5">₹{pick.signalDetails.stopLoss.toFixed(2)}</div>
              <div className="text-[10px] text-slate-400">-{(((pick.signalDetails.entry - pick.signalDetails.stopLoss) / pick.signalDetails.entry) * 100).toFixed(1)}% Risk</div>
            </div>
            <div>
              <div className="text-slate-500 text-[10px] font-semibold uppercase">Targets</div>
              <div className="font-bold text-blue-400 font-mono mt-0.5">T1: ₹{pick.signalDetails.target1.toFixed(2)}</div>
              {pick.signalDetails.target2 && (
                <div className="text-[10px] text-indigo-300 font-mono">T2: ₹{pick.signalDetails.target2.toFixed(2)}</div>
              )}
            </div>
          </div>

          {/* Quick Action Presets */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-400 font-medium">Quick Presets:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSetEntryToCmp}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors font-medium cursor-pointer"
              >
                Use Live CMP (₹{pick.currentPrice.toFixed(2)})
              </button>
              <button
                type="button"
                onClick={handleResetToSignal}
                className="px-2.5 py-1 rounded-lg bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 border border-blue-800/50 transition-colors font-medium cursor-pointer"
              >
                Reset to Strategy Signal
              </button>
            </div>
          </div>

          {/* Inputs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Total Trading Capital (₹)
              </label>
              <input
                type="number"
                value={totalCapital}
                onChange={(e) => setTotalCapital(Number(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                placeholder="e.g. 500000"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Risk Per Trade (% of Capital)
              </label>
              <select
                value={riskPercent}
                onChange={(e) => setRiskPercent(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value={0.5}>0.5% (Conservative)</option>
                <option value={1.0}>1.0% (Standard Zerodha Swing)</option>
                <option value={1.5}>1.5% (Aggressive)</option>
                <option value={2.0}>2.0% (High Conviction)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Planned Entry Price (₹)
              </label>
              <input
                type="number"
                step="0.1"
                value={customEntry}
                onChange={(e) => setCustomEntry(Number(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 font-mono font-bold text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Technical Stop-Loss (₹)
              </label>
              <input
                type="number"
                step="0.1"
                value={customSl}
                onChange={(e) => setCustomSl(Number(e.target.value) || 0)}
                className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border ${!isValidSl ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-800'} text-rose-400 font-mono font-bold text-sm focus:outline-none focus:border-rose-500`}
              />
              {!isValidSl && (
                <p className="text-[11px] text-rose-400 font-medium mt-1">
                  Stop-loss must be lower than entry price (₹{entryPrice.toFixed(2)}).
                </p>
              )}
            </div>
          </div>

          {/* Results Summary Box */}
          <div className="bg-slate-950/80 p-5 rounded-xl border border-slate-800 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex flex-col justify-between">
                <div className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Max Risk</div>
                <div className="text-base font-extrabold text-rose-400 font-mono mt-1">
                  ₹{maxAllowedRiskAmount.toLocaleString('en-IN')}
                </div>
              </div>

              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex flex-col justify-between">
                <div className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Risk / Share</div>
                <div className="text-base font-extrabold text-amber-400 font-mono mt-1">
                  ₹{riskPerShare.toFixed(2)}
                  <div className="text-[10px] text-slate-400 font-normal">({slPercent.toFixed(1)}%)</div>
                </div>
              </div>

              <div className="p-3 bg-blue-950/40 rounded-xl border border-blue-800/50 flex flex-col justify-between">
                <div className="text-[10px] text-blue-300 uppercase font-extrabold tracking-wider">Allowed Qty</div>
                <div className="text-base font-extrabold text-blue-400 font-mono mt-1">
                  {calculatedShares.toLocaleString('en-IN')} Shares
                </div>
              </div>

              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex flex-col justify-between">
                <div className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Investment / Exposure</div>
                <div className="text-base font-extrabold text-slate-200 font-mono mt-1">
                  ₹{Math.round(totalInvestmentRequired).toLocaleString('en-IN')}
                  <div className="text-[10px] text-slate-400 font-normal">({capitalExposurePercent.toFixed(1)}% of Capital)</div>
                </div>
              </div>
            </div>

            {/* Target Expectations */}
            <div className="pt-3 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="flex justify-between items-center p-3 bg-slate-900/60 rounded-xl border border-slate-800/60">
                <div>
                  <div className="text-slate-400 font-medium">Target 1 (₹{target1.toFixed(2)})</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Upside: +{target1UpsidePct.toFixed(1)}% • R:R 1:{rr1.toFixed(1)}
                  </div>
                </div>
                <span className="font-bold text-emerald-400 font-mono text-sm">
                  +₹{Math.round(target1Profit).toLocaleString('en-IN')}
                </span>
              </div>

              {target2 ? (
                <div className="flex justify-between items-center p-3 bg-slate-900/60 rounded-xl border border-slate-800/60">
                  <div>
                    <div className="text-slate-400 font-medium">Target 2 (₹{target2.toFixed(2)})</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Upside: +{target2UpsidePct.toFixed(1)}% • R:R 1:{rr2.toFixed(1)}
                    </div>
                  </div>
                  <span className="font-bold text-emerald-400 font-mono text-sm">
                    +₹{Math.round(target2Profit).toLocaleString('en-IN')}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center p-3 bg-slate-900/40 rounded-xl border border-slate-800/40 text-slate-500 text-xs">
                  Target 2: Trail with 20 EMA
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-white text-sm transition-colors cursor-pointer"
          >
            Close Calculator
          </button>
        </div>
      </div>
    </div>
  );
};
