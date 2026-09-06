import { useState, useEffect } from 'react';
import type { SectorNavData } from '../engine/types';
import { GlassCard } from './GlassCard';
import { getSectorsNavData } from '../engine/universe';

interface SectorStrengthExplorerProps {
  sectors?: SectorNavData[];
  onSelectSector?: (sectorName: string) => void;
}

/**
 * Sector strength heatmap + constituent drilldown.
 *
 * Card architecture follows the unified design system:
 *   - Header banner uses .kite-card + .kite-card-body for the same
 *     14px radius / 1px hairline treatment as the rest of the app.
 *   - Each sector tile uses the same primitive. The colored heatmap
 *     cell stays semantic (green = positive, rose = negative) — it's
 *     data, not decoration. The outer chrome is neutral.
 *   - The constituent drilldown uses the same header anatomy
 *     (icon + title + subtitle) with a hairline divider.
 *
 * No boxes around the timeframe buttons, no shadowed white panels,
 * no indigo-50 chips that fight the typography hierarchy.
 */
export const SectorStrengthExplorer: React.FC<SectorStrengthExplorerProps> = ({
  sectors: inputSectors,
  onSelectSector,
}) => {
  const [sectors, setSectors] = useState<SectorNavData[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSectorsNavData().then((data) => {
      if (!cancelled) {
        setSectors(data);
        setLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const sectorData = inputSectors || sectors;
  const [selectedTimeframe, setSelectedTimeframe] = useState<'d1' | 'w1' | 'm1' | 'm3' | 'm6'>('m1');
  const [activeSector, setActiveSector] = useState<SectorNavData | null>(null);

  useEffect(() => {
    if (loaded && sectorData.length > 0) {
      setActiveSector(sectorData[0]);
    }
  }, [loaded, sectorData]);

  const formatPct = (val: number) => {
    const isPos = val >= 0;
    return `${isPos ? '+' : ''}${val.toFixed(2)}%`;
  };

  const getHeatmapColor = (val: number) => {
    if (val >= 10) return 'bg-emerald-600 text-white border-emerald-700';
    if (val >= 3) return 'bg-emerald-100 text-emerald-950 border-emerald-300 font-bold';
    if (val >= 0) return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold';
    if (val >= -3) return 'bg-rose-50 text-rose-800 border-rose-200 font-semibold';
    if (val >= -10) return 'bg-rose-100 text-rose-950 border-rose-300 font-bold';
    return 'bg-rose-600 text-white border-rose-700';
  };

  return (
    <div className="space-y-6">
      {/* HEADER BANNER — uses unified card anatomy */}
      <GlassCard padding="none">
        <div
          className="kite-card-body"
          style={{ containerType: 'inline-size', containerName: 'sector-banner' }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="min-w-0">
              <div
                className="flex items-center gap-2 mb-1.5"
                style={{ fontSize: 'clamp(11px, 2.4cqi, 13px)' }}
              >
                <span className="font-bold text-[color:var(--text-secondary)]">
                  Wagner & Pedicelli Relative Strength Engine
                </span>
                <span className="w-1 h-1 rounded-full bg-[color:var(--text-quaternary)]" />
                <span className="font-semibold text-[color:var(--text-tertiary)]">
                  Equal-Weighted NAV Baselines
                </span>
              </div>
              <h2
                className="font-extrabold text-[color:var(--text-primary)] tracking-tight"
                style={{ fontSize: 'clamp(18px, 4.5cqi, 24px)' }}
              >
                Equal-Weighted Sector & Subsector NAV Heatmap
              </h2>
              <p
                className="mt-1 max-w-3xl leading-relaxed text-[color:var(--text-secondary)]"
                style={{ fontSize: 'clamp(11px, 2.6cqi, 13px)' }}
              >
                Standard sector indexes are heavily skewed by mega-cap weights (e.g., Reliance, HDFC Bank).
                Our equal-weighted NAV engine tracks true sector breadth across 1D, 1W, 1M, 3M, and 6M
                windows to surface genuine momentum leaders.
              </p>
            </div>

            {/* Timeframe Selector — segmented control, not a stack of buttons. */}
            <div
              className="flex items-center gap-1 p-1 rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--ground-secondary)] shrink-0 self-start lg:self-center"
              role="tablist"
              aria-label="Timeframe"
            >
              {(['d1', 'w1', 'm1', 'm3', 'm6'] as const).map((tf) => {
                const isActive = selectedTimeframe === tf;
                return (
                  <button
                    key={tf}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setSelectedTimeframe(tf)}
                    className={`px-3 py-1.5 rounded-xl font-bold uppercase tracking-wide transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[color:var(--text-primary)] text-[color:var(--ground)]'
                        : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--ground)]'
                    }`}
                    style={{ fontSize: 'clamp(10px, 2.4cqi, 12px)' }}
                  >
                    {tf === 'd1'
                      ? '1 Day'
                      : tf === 'w1'
                      ? '1 Wk'
                      : tf === 'm1'
                      ? '1 Mo'
                      : tf === 'm3'
                      ? '3 Mo'
                      : '6 Mo'}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* SECTOR GRID HEATMAP — each tile is a card following the unified anatomy */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sectorData.map((sec) => {
          const retVal = sec.returns[selectedTimeframe];
          const isSelected = activeSector?.id === sec.id;

          return (
            <GlassCard
              key={sec.id}
              padding="none"
              onClick={() => {
                setActiveSector(sec);
                if (onSelectSector) onSelectSector(sec.name);
              }}
              className={`cursor-pointer transition-colors duration-200 flex flex-col ${
                isSelected
                  ? 'ring-1 ring-[color:var(--accent-blue)]'
                  : 'hover:bg-[color:var(--card-bg-hover)]'
              }`}
            >
              <div
                className="kite-card-body"
                style={{ containerType: 'inline-size', containerName: 'sector-tile' }}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <h3
                      className="kite-card-title"
                      style={{ fontSize: 'clamp(13px, 4cqi, 16px)' }}
                    >
                      {sec.name}
                    </h3>
                    <span
                      className="block mt-0.5 text-[color:var(--text-tertiary)] font-semibold"
                      style={{ fontSize: 'clamp(10px, 2.4cqi, 12px)' }}
                    >
                      {sec.universeType} · {sec.stockCount} stocks
                    </span>
                  </div>
                  {/* Heatmap cell — semantic color carries the data meaning. */}
                  <div
                    className={`px-3 py-1.5 rounded-xl border font-mono font-bold shrink-0 self-start ${getHeatmapColor(
                      retVal
                    )}`}
                    style={{ fontSize: 'clamp(11px, 3cqi, 13px)' }}
                  >
                    {formatPct(retVal)}
                  </div>
                </div>

                {/* Multi-timeframe mini matrix — same single-material chrome. */}
                <div
                  className="grid grid-cols-5 gap-1 py-1.5 my-3 border-y border-[color:var(--card-divider)] text-center"
                >
                  {(['d1', 'w1', 'm1', 'm3', 'm6'] as const).map((tf) => {
                    const isCurrentTf = selectedTimeframe === tf;
                    const val = sec.returns[tf];
                    const isPos = val >= 0;
                    return (
                      <div
                        key={tf}
                        className={`py-1.5 rounded-lg transition-colors flex flex-col items-center justify-center ${
                          isCurrentTf
                            ? 'bg-[color:var(--text-primary)] text-[color:var(--ground)]'
                            : 'hover:bg-[color:var(--ground-secondary)]'
                        }`}
                      >
                        <div
                          className={`font-extrabold uppercase tracking-wider ${
                            isCurrentTf ? 'text-[color:var(--ground)] opacity-70' : 'text-[color:var(--text-tertiary)]'
                          }`}
                          style={{ fontSize: 'clamp(8px, 2cqi, 9px)' }}
                        >
                          {tf.toUpperCase()}
                        </div>
                        <div
                          className={`font-extrabold font-mono mt-0.5 leading-none ${
                            isCurrentTf
                              ? 'text-[color:var(--ground)]'
                              : isPos
                              ? 'text-[color:var(--success-green)]'
                              : 'text-[color:var(--hazard-red)]'
                          }`}
                          style={{ fontSize: 'clamp(10px, 2.4cqi, 11px)' }}
                        >
                          {val >= 0 ? '+' : ''}
                          {val.toFixed(1)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                className="flex items-center justify-between gap-2 px-[--card-body-px] py-2.5 border-t border-[color:var(--card-divider)] mt-auto"
                style={{ fontSize: 'clamp(10px, 2.4cqi, 12px)' }}
              >
                <span className="text-[color:var(--text-tertiary)] font-semibold">
                  Trend Alignment
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-bold ${
                    sec.emaAlignment.includes('Bullish')
                      ? 'bg-[color:var(--success-green)]/10 text-[color:var(--success-green)]'
                      : 'bg-[color:var(--ground-secondary)] text-[color:var(--text-secondary)]'
                  }`}
                >
                  {sec.emaAlignment}
                </span>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* OUTPERFORMER CONSTITUENT DRILLDOWN — unified card header + body */}
      {activeSector && (
        <GlassCard padding="none">
          <div
            className="kite-card-header"
            style={{ containerType: 'inline-size', containerName: 'sector-detail' }}
          >
            <span className="kite-card-icon text-[color:var(--accent-blue)]" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                width="100%"
                height="100%"
                stroke="currentColor"
                strokeWidth={2.25}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <h3
                className="kite-card-title"
                style={{ fontSize: 'clamp(13px, 4cqi, 16px)' }}
              >
                Outperforming Constituents: {activeSector.name}
              </h3>
              <p
                className="kite-card-subtitle"
                style={{ fontSize: 'clamp(10px, 2.2cqi, 11px)' }}
              >
                Wagner & Pedicelli relative strength outperformance · 30-day lookback
              </p>
            </div>
            <span
              className="hidden sm:inline-flex items-center font-extrabold text-[color:var(--accent-blue)] shrink-0"
              style={{ fontSize: 'clamp(10px, 2.4cqi, 12px)' }}
            >
              vs Sector NAV Alpha
            </span>
          </div>

          <div className="kite-card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeSector.topOutperformingConstituents.map((item, idx) => (
                <div
                  key={item.symbol}
                  className="p-3.5 rounded-xl border border-[color:var(--card-divider)] flex items-center justify-between transition-colors hover:bg-[color:var(--card-bg-hover)]"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[color:var(--text-quaternary)] font-mono font-bold shrink-0">
                        #{idx + 1}
                      </span>
                      <span
                        className="font-extrabold text-[color:var(--text-primary)] truncate"
                        style={{ fontSize: 'clamp(12px, 3cqi, 14px)' }}
                      >
                        {item.symbol}
                      </span>
                    </div>
                    <div
                      className="text-[color:var(--text-tertiary)] font-medium truncate mt-0.5"
                      style={{ fontSize: 'clamp(10px, 2.4cqi, 12px)' }}
                    >
                      {item.name}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className="text-[color:var(--text-primary)] font-mono font-bold tabular-nums"
                      style={{ fontSize: 'clamp(11px, 2.8cqi, 13px)' }}
                    >
                      ₹{item.price.toFixed(2)}
                    </div>
                    <div
                      className="font-extrabold text-[color:var(--success-green)] bg-[color:var(--success-green)]/10 px-2.5 py-0.5 rounded-full border border-[color:var(--success-green)]/20 mt-1 inline-block"
                      style={{ fontSize: 'clamp(9px, 2.2cqi, 11px)' }}
                    >
                      +{item.versusNav.toFixed(2)}% vs NAV
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
};
