import type { FC } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useStrategy } from '../context/StrategyContext';
import type { CapCategory } from '../engine/types';
import { ThemeToggle } from './ThemeToggle';
import { Icon } from './Icon';
import { useToast } from './useToast';

interface SidebarProps {
  activeTab?: string;
}

export const Sidebar: FC<SidebarProps> = ({ activeTab }) => {
  const isSignalsTab = activeTab === 'signals' || !activeTab;
  const {
    strategies,
    activeStrategyId,
    setActiveStrategyId,
    capCategory,
    setCapCategory,
    isScanning,
    runScan,
  } = useStrategy();
  const toast = useToast();
  const prefersReducedMotion = useReducedMotion();

  const runScanWithToast = async () => {
    if (isScanning) return;
    try {
      await runScan();
      toast.success('Scan complete.');
    } catch (err: any) {
      toast.error(`Scan failed: ${err?.message || 'Unknown error'}`);
    }
  };

  const capOptions: { id: CapCategory; label: string; sub: string }[] = [
    { id: 'all', label: 'All Market Caps', sub: 'Full Universe (~30 Stocks)' },
    { id: 'large', label: 'Large Cap', sub: 'Nifty 100 Leaders' },
    { id: 'mid', label: 'Mid Cap', sub: 'High Growth Nifty 150' },
    { id: 'small', label: 'Small Cap', sub: 'High Alpha Nifty 250' },
  ];

  return (
    <aside className="w-full lg:w-72 xl:w-80 flex-shrink-0 flex flex-col gap-6 p-4 lg:p-6 kite-card">
      {/* Theme toggle + section label. The Kite/yfinance status pill used to
          be duplicated here; it now lives only in the top bar, so the data
          source is stated exactly once in the app. */}
      <div className="flex items-center justify-between pb-5 border-b border-[color:var(--card-divider)]">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          {isSignalsTab ? 'Algorithmic Screener' : 'Navigation'}
        </p>
        <ThemeToggle />
      </div>

      {/* Only show strategy/scan controls on signals tab */}
      {isSignalsTab && (
        <>
          {/* Strategy Selector Menu */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                Strategy Selector
              </span>
            </div>

            <nav className="flex flex-col gap-2">
              {strategies.map((strat, index) => {
                const isActive = strat.id === activeStrategyId;
            return (
              <button
                key={strat.id}
                onClick={() => setActiveStrategyId(strat.id)}
                className={`w-full text-left p-3 transition-colors duration-150 flex flex-col gap-1.5 border border-transparent ${
                  isActive
                    ? 'bg-[color:var(--ground-secondary)] text-[color:var(--text-primary)] border-[color:var(--border-default)]'
                    : 'hover:bg-[color:var(--card-bg-hover)] text-[color:var(--text-primary)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`text-[11px] font-extrabold w-5 h-5 inline-flex items-center justify-center shrink-0 ${
                        isActive
                          ? 'text-[color:var(--text-primary)]'
                          : 'text-[color:var(--text-tertiary)]'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="font-extrabold text-sm leading-tight truncate">
                      {strat.name}
                    </span>
                  </div>
                  {/* Zerodha label removed */}
                </div>
                <p
                  className="text-xs pl-7.5 line-clamp-1 font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {strat.category}
                </p>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Scan Universe — this is the *input* to the scan (which stocks get
          fetched). The cap pills in the results toolbar only refine what is
          already on screen; naming them differently stops the two reading
          as the same control duplicated. */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col gap-0.5 px-1">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Scan Universe
          </span>
          <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            Which stocks the engine fetches
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {capOptions.map((opt) => {
            const isSelected = capCategory === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setCapCategory(opt.id)}
                aria-pressed={isSelected}
                title={opt.sub}
                className="p-3 text-left border flex flex-col justify-between h-[68px] transition-colors rounded-lg"
                style={{
                  backgroundColor: isSelected ? 'var(--ground)' : 'transparent',
                  borderColor: isSelected ? 'var(--accent-brand)' : 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                <span className={`text-xs leading-snug ${isSelected ? 'font-bold' : 'font-medium'}`}>
                  {opt.label}
                </span>
                <span
                  className="text-[10px] font-bold"
                  style={{ color: isSelected ? 'var(--accent-brand)' : 'var(--text-secondary)' }}
                >
                  {opt.id.toUpperCase()}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      </>
      )}

      {/* Action: Run Parallel Engine Scan.
          The button reflects its own busy state and names the symbol being
          processed. The canonical progress readout (percentage + progress
          line) lives in the top bar so there is exactly one scan gauge. */}
      <div className="pt-4">
        <button
          onClick={() => runScanWithToast()}
          disabled={isScanning}
          aria-label={isScanning ? 'Scan in progress' : 'Run strategy scan'}
          className="w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
          style={{
            backgroundColor: isScanning ? 'var(--elevated-3)' : 'var(--accent-brand)',
            color: isScanning ? 'var(--text-secondary)' : '#fff',
            cursor: isScanning ? 'not-allowed' : 'pointer',
          }}
        >
          <motion.span
            className="flex items-center"
            animate={isScanning && !prefersReducedMotion ? { rotate: 360 } : { rotate: 0 }}
            transition={
              isScanning && !prefersReducedMotion
                ? { repeat: Infinity, ease: 'linear', duration: 0.9 }
                : { duration: 0.2 }
            }
          >
            <Icon name="refresh" size={16} />
          </motion.span>
        </button>
      </div>
    </aside>
  );
};
