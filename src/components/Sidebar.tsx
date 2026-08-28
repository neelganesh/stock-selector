import type { FC } from 'react';
import { useStrategy } from '../context/StrategyContext';
import type { CapCategory } from '../engine/types';

export const Sidebar: FC = () => {
  const {
    strategies,
    activeStrategyId,
    setActiveStrategyId,
    capCategory,
    setCapCategory,
    isScanning,
    progress,
    activeDataSource,
    setIsZerodhaModalOpen,
    runScan,
  } = useStrategy();

  const capOptions: { id: CapCategory; label: string; sub: string }[] = [
    { id: 'all', label: 'All Market Caps', sub: 'Full Universe (~30 Stocks)' },
    { id: 'large', label: 'Large Cap', sub: 'Nifty 100 Leaders' },
    { id: 'mid', label: 'Mid Cap', sub: 'High Growth Nifty 150' },
    { id: 'small', label: 'Small Cap', sub: 'High Alpha Nifty 250' },
  ];

  const isKiteLive = activeDataSource.includes('Kite');

  return (
    <aside className="w-full lg:w-72 xl:w-80 flex-shrink-0 flex flex-col gap-6 p-4 lg:p-6 vision-glass rounded-2xl border border-white/60 shadow-xl shadow-slate-200/50">
      {/* Sleek Monochrome Header Icon & Brand */}
      <div className="flex items-center justify-between pb-5 border-b border-slate-200/60">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md shadow-slate-900/20 ring-1 ring-slate-800">
            {/* Sleek geometric glass icon */}
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          </div>
          <div>
            <h1 className="font-semibold text-slate-900 text-base leading-tight tracking-tight">
              Quant Vision
            </h1>
            <p className="text-xs text-slate-500 font-medium">Algorithmic Screener</p>
          </div>
        </div>

        <button
          onClick={() => setIsZerodhaModalOpen(true)}
          className={`text-[10px] font-bold px-2 py-1 rounded-md border transition-all cursor-pointer flex items-center gap-1 ${
            isKiteLive
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
          }`}
          title="Click to configure Zerodha Kite API"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isKiteLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span>{isKiteLive ? 'Kite API Live' : 'yfinance'}</span>
        </button>
      </div>

      {/* Strategy Selector Menu (Zerodha Swing 1st) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Strategy Selector
          </span>
          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            Pluggable Modules
          </span>
        </div>

        <nav className="flex flex-col gap-2">
          {strategies.map((strat, index) => {
            const isActive = strat.id === activeStrategyId;
            return (
              <button
                key={strat.id}
                onClick={() => setActiveStrategyId(strat.id)}
                className={`w-full text-left p-3.5 rounded-xl transition-all duration-200 flex flex-col gap-1.5 border ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/15 scale-[1.01]'
                    : 'bg-white/50 hover:bg-white text-slate-700 border-slate-200/60 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`text-[11px] font-extrabold w-5 h-5 rounded-full inline-flex items-center justify-center shrink-0 ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="font-extrabold text-sm leading-tight truncate">
                      {strat.name}
                    </span>
                  </div>
                  {index === 0 && (
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded shrink-0 ${
                        isActive
                          ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      Zerodha
                    </span>
                  )}
                </div>
                <p
                  className={`text-xs pl-7.5 line-clamp-1 font-medium ${
                    isActive ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  {strat.category}
                </p>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Market Cap Universe Selector */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Market Cap Scope
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {capOptions.map((opt) => {
            const isSelected = capCategory === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setCapCategory(opt.id)}
                className={`p-3 rounded-xl text-left border flex flex-col justify-between h-[68px] transition-all ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 font-extrabold shadow-sm'
                    : 'bg-white/40 hover:bg-white text-slate-700 border-slate-200/60'
                }`}
              >
                <span className="text-xs font-bold leading-snug">{opt.label}</span>
                <span
                  className={`text-[10px] font-extrabold ${
                    isSelected ? 'text-slate-300' : 'text-slate-400'
                  }`}
                >
                  {opt.id.toUpperCase()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Action: Run Parallel Engine Scan */}
      <div className="pt-2 mt-auto">
        <button
          onClick={() => runScan()}
          disabled={isScanning}
          className={`w-full py-3 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
            isScanning
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 active:scale-[0.99]'
          }`}
        >
          {isScanning ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <span>Evaluating Engine...</span>
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>Run Parallel Scan</span>
            </>
          )}
        </button>

        {/* Real-time Progress Output */}
        {isScanning && (
          <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-slate-700">
              <span>Scanning Stocks</span>
              <span>{progress.percent}%</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-150"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500">
              <span className="truncate max-w-[140px] font-mono">
                {progress.currentSymbol || 'Processing...'}
              </span>
              <span>
                {progress.scanned} / {progress.total}
              </span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
