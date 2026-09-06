import React, { useState, useEffect } from 'react';
import type { SectorNavData } from '../engine/types';
import { GlassCard } from './GlassCard';
import { getSectorsNavData } from '../engine/universe';

interface SectorStrengthExplorerProps {
  sectors?: SectorNavData[];
  onSelectSector?: (sectorName: string) => void;
}

export const SectorStrengthExplorer: React.FC<SectorStrengthExplorerProps> = ({
  sectors: inputSectors,
  onSelectSector,
}) => {
  const [sectors, setSectors] = useState<SectorNavData[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'d1' | 'w1' | 'm1' | 'm3' | 'm6'>('m1');
  const [activeSector, setActiveSector] = useState<SectorNavData | null>(null);

  useEffect(() => {
    if (inputSectors) {
      setSectors(inputSectors);
      if (inputSectors.length > 0 && !activeSector) {
        setActiveSector(inputSectors[0]);
      }
    } else {
      getSectorsNavData().then((data) => {
        setSectors(data);
        if (data.length > 0 && !activeSector) {
          setActiveSector(data[0]);
        }
      });
    }
  }, [inputSectors]);

  useEffect(() => {
    if (sectors.length > 0 && !activeSector) {
      setActiveSector(sectors[0]);
    }
  }, [sectors, activeSector]);

  const formatPct = (val: number) => {
    const isPos = val >= 0;
    return `${isPos ? '+' : ''}${val.toFixed(2)}%`;
  };

  const getHeatmapColor = (val: number) => {
    if (val >= 10) return 'bg-emerald-600 text-white border-emerald-700 shadow-sm';
    if (val >= 3) return 'bg-emerald-100 text-emerald-950 border-emerald-300 font-bold';
    if (val >= 0) return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold';
    if (val >= -3) return 'bg-rose-50 text-rose-800 border-rose-200 font-semibold';
    if (val >= -10) return 'bg-rose-100 text-rose-950 border-rose-300 font-bold';
    return 'bg-rose-600 text-white border-rose-700 shadow-sm';
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <GlassCard className="p-6 bg-white/80 border border-slate-200/80 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Wagner & Pedicelli Relative Strength Engine
              </span>
              <span className="text-xs font-semibold text-slate-500">• Equal-Weighted NAV Baselines</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Equal-Weighted Sector & Subsector NAV Heatmap
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
              Standard sector indexes are heavily skewed by mega-cap weights (e.g., Reliance, HDFC Bank).
              Our equal-weighted NAV engine tracks true sector breadth across 1D, 1W, 1M, 3M, and 6M windows to surface genuine momentum leaders.
            </p>
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 self-start lg:self-center shadow-inner">
            {(['d1', 'w1', 'm1', 'm3', 'm6'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer ${
                  selectedTimeframe === tf
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                }`}
              >
                {tf === 'd1' ? '1 Day' : tf === 'w1' ? '1 Wk' : tf === 'm1' ? '1 Mo' : tf === 'm3' ? '3 Mo' : '6 Mo'}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* Sector Grid Heatmap */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
        {sectors.map((sec) => {
          const retVal = sec.returns[selectedTimeframe];
          const isSelected = activeSector?.id === sec.id;

          return (
            <GlassCard
              key={sec.id}
              onClick={() => {
                setActiveSector(isSelected ? null : sec);
                if (onSelectSector) onSelectSector(sec.name);
              }}
              className={`p-5 rounded-2xl cursor-pointer transition-all duration-200 ${
                isSelected
                  ? 'ring-2 ring-blue-600 bg-white border-blue-300 shadow-md'
                  : 'bg-white/80 hover:border-slate-300 border-slate-200/80'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base tracking-tight leading-snug">{sec.name}</h3>
                  <span className="text-xs font-semibold text-slate-500 block mt-0.5">
                    {sec.universeType} • {sec.stockCount} Stocks
                  </span>
                </div>
                <div
                  className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold shrink-0 self-start ${getHeatmapColor(
                    retVal
                  )}`}
                >
                  {formatPct(retVal)}
                </div>
              </div>

              {/* Multi-Timeframe Mini Matrix */}
              <div className="grid grid-cols-5 gap-1 py-2.5 mb-3 border-y border-slate-100 text-center text-xs bg-slate-50 rounded-xl px-1">
                {(['d1', 'w1', 'm1', 'm3', 'm6'] as const).map((tf) => {
                  const isCurrentTf = selectedTimeframe === tf;
                  const val = sec.returns[tf];
                  const isPos = val >= 0;
                  return (
                    <div
                      key={tf}
                      className={`py-1.5 rounded-lg transition-all flex flex-col items-center justify-center ${
                        isCurrentTf
                          ? 'bg-slate-900 text-white font-bold shadow-xs'
                          : 'hover:bg-slate-200/60'
                      }`}
                    >
                      <div
                        className={`text-[9px] uppercase font-extrabold tracking-wider ${
                          isCurrentTf ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {tf.toUpperCase()}
                      </div>
                      <div
                        className={`text-[11px] font-extrabold font-mono mt-0.5 leading-none ${
                          isCurrentTf
                            ? 'text-white'
                            : isPos
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {val >= 0 ? '+' : ''}
                        {val.toFixed(1)}%
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Top Performers Section */}
              {isSelected && sec.topOutperformingConstituents.length > 0 && (
                <div className="border-t border-slate-200 pt-3 mt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span className="text-xs font-bold text-slate-700">Top Performers vs NAV</span>
                  </div>
                  <div className="space-y-1.5">
                    {sec.topOutperformingConstituents.slice(0, 5).map((item, idx) => (
                      <div
                        key={item.symbol}
                        className="flex items-center justify-between py-1.5 px-2 bg-slate-50 rounded-lg hover:bg-white transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-mono font-bold text-slate-400 w-4">#{idx + 1}</span>
                          <span className="font-bold text-slate-900 text-sm truncate">{item.symbol}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-slate-500">₹{item.price.toFixed(0)}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            +{item.versusNav.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs mt-auto">
                <span className="text-slate-500 font-semibold">Trend Alignment:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    sec.emaAlignment.includes('Bullish')
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {sec.emaAlignment}
                </span>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
};
