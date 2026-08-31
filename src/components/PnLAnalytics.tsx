import { useState, useEffect } from 'react';
import { GlassCard } from './GlassCard';
import { AnimatedNumber } from './AnimatedNumber';
import { calculateExecutionXIRR, calculateExecutionCAGR, formatPct, formatCurrency } from '../utils/analytics';
import type { StrategyExecution, TradeCashFlow } from '../lib/supabase';
import { useAuth } from './AuthProvider';

interface PnLAnalyticsProps {
  isLoggedIn: boolean;
  onLoginClick: () => void;
}

export function PnLAnalytics({ isLoggedIn, onLoginClick }: PnLAnalyticsProps) {
  const { user } = useAuth();
  const [executions, setExecutions] = useState<StrategyExecution[]>([]);
  const [cashFlows, setCashFlows] = useState<TradeCashFlow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalInvested: 0,
    currentValue: 0,
    realizedPnL: 0,
    unrealizedPnL: 0,
    totalCharges: 0,
    xirr: null as number | null,
    cagr: null as number | null,
  });

  const fetchData = async () => {
    if (!user) {
      setExecutions([]);
      setCashFlows([]);
      setIsLoading(false);
      return;
    }

    try {
      const [execRes, cfRes] = await Promise.all([
        fetch('/api/executions'),
        fetch('/api/executions/cashflows'),
      ]);

      if (execRes.ok) {
        const execData = await execRes.json();
        setExecutions(execData);
      }

      if (cfRes.ok) {
        const cfData = await cfRes.json();
        setCashFlows(cfData);
      }
    } catch (err) {
      console.error('Failed to fetch P&L data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    if (!executions.length && !cashFlows.length) return;

    // Calculate summary
    let totalInvested = 0;
    let currentValue = 0;
    let realizedPnL = 0;
    let unrealizedPnL = 0;
    let totalCharges = 0;

    // Aggregate from executions
    executions.forEach(ex => {
      if (ex.status === 'entry_filled' || ex.status === 'gtt_placed' || 
          ex.status === 'target1_hit' || ex.status === 'target2_hit' ||
          ex.status === 'stop_loss_hit' || ex.status === 'manually_exited') {
        const capitalAllocated = ex.entry_price * ex.quantity;
        totalInvested += capitalAllocated;
        currentValue += capitalAllocated + (ex.realized_pnl || 0) + (ex.unrealized_pnl || 0);
        realizedPnL += ex.realized_pnl || 0;
        unrealizedPnL += ex.unrealized_pnl || 0;
        totalCharges += ex.total_charges || 0;
      }
    });

    // Calculate XIRR from all cash flows
    const allFlows = cashFlows.map(cf => ({
      date: cf.date,
      amount: cf.amount,
      type: cf.type,
    }));
    const xirr = calculateExecutionXIRR(allFlows);

    // Calculate CAGR (weighted average across executions)
    let weightedCagr = 0;
    let totalWeight = 0;
    executions.forEach(ex => {
      if (ex.entry_filled_price && ex.entry_filled_at) {
        const cagrVal = calculateExecutionCAGR(
          ex.entry_filled_price,
          ex.exit_filled_price || ex.entry_filled_price, // Use current price if available
          ex.entry_filled_at,
          ex.exit_filled_at || undefined
        );
        if (cagrVal !== null) {
          const capitalAllocated = ex.entry_price * ex.quantity;
          weightedCagr += cagrVal * capitalAllocated;
          totalWeight += capitalAllocated;
        }
      }
    });
    const cagr = totalWeight > 0 ? weightedCagr / totalWeight : null;

    setSummary({
      totalInvested,
      currentValue,
      realizedPnL,
      unrealizedPnL,
      totalCharges,
      xirr,
      cagr,
    });
  }, [executions, cashFlows]);

  if (!isLoggedIn) {
    return (
      <GlassCard className="p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">P&L Analytics</h3>
        <p className="text-sm text-slate-500 mb-4 max-w-xs mx-auto">
          Sign in to view your portfolio performance metrics including CAGR and XIRR.
        </p>
        <button
          onClick={onLoginClick}
          className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors"
        >
          Sign In
        </button>
      </GlassCard>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <GlassCard key={i} className="p-6 animate-pulse">
            <div className="h-8 w-3/4 bg-slate-200 rounded mb-2" />
            <div className="h-12 w-1/2 bg-slate-200 rounded" />
          </GlassCard>
        ))}
      </div>
    );
  }

  const { totalInvested, currentValue, realizedPnL, unrealizedPnL, totalCharges, xirr, cagr } = summary;
  const totalPnL = realizedPnL + unrealizedPnL;
  const totalReturnPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Total Invested</p>
          <AnimatedNumber value={totalInvested} format={formatCurrency} className="text-2xl font-extrabold text-slate-900" />
        </GlassCard>

        <GlassCard className="p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Current Value</p>
          <AnimatedNumber value={currentValue} format={formatCurrency} className="text-2xl font-extrabold text-slate-900" />
        </GlassCard>

        <GlassCard className="p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Total P&L</p>
          <AnimatedNumber 
            value={totalPnL} 
            format={v => formatCurrency(v, 0)} 
            className={`text-2xl font-extrabold ${totalPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
          />
          <p className={`text-xs font-semibold mt-1 ${totalPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {totalReturnPct >= 0 ? '+' : ''}{totalReturnPct.toFixed(2)}%
          </p>
        </GlassCard>

        <GlassCard className="p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Total Charges</p>
          <AnimatedNumber value={totalCharges} format={formatCurrency} className="text-2xl font-extrabold text-amber-600" />
        </GlassCard>
      </div>

      {/* Advanced Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">XIRR (Annualized)</p>
            <span className="text-[10px] text-slate-400">IRR of all cash flows</span>
          </div>
          <AnimatedNumber 
            value={xirr ?? 0} 
            format={formatPct} 
            className={`text-3xl font-extrabold ${xirr !== null && xirr >= 0 ? 'text-emerald-600' : xirr !== null ? 'text-rose-600' : 'text-slate-900'}`}
          />
          <p className="text-xs text-slate-500 mt-2">
            Extended Internal Rate of Return accounting for timing of all cash flows
          </p>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">CAGR (Annualized)</p>
            <span className="text-[10px] text-slate-400">Weighted avg. growth rate</span>
          </div>
          <AnimatedNumber 
            value={cagr ?? 0} 
            format={formatPct} 
            className={`text-3xl font-extrabold ${cagr !== null && cagr >= 0 ? 'text-emerald-600' : cagr !== null ? 'text-rose-600' : 'text-slate-900'}`}
          />
          <p className="text-xs text-slate-500 mt-2">
            Compound Annual Growth Rate across all positions
          </p>
        </GlassCard>
      </div>

      {/* Breakdown */}
      <GlassCard className="p-5">
        <h4 className="text-sm font-bold text-slate-800 mb-4">P&L Breakdown</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Realized P&L</p>
            <p className="font-bold text-emerald-600">{formatCurrency(realizedPnL)}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Unrealized P&L</p>
            <p className="font-bold text-blue-600">{formatCurrency(unrealizedPnL)}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Total Charges</p>
            <p className="font-bold text-amber-600">{formatCurrency(totalCharges)}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Net P&L</p>
            <p className={`font-bold ${totalPnL - totalCharges >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatCurrency(totalPnL - totalCharges)}
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Executions Table */}
      {executions.length > 0 && (
        <GlassCard className="p-5">
          <h4 className="text-sm font-bold text-slate-800 mb-4">Strategy Executions</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-200">
                  <th className="pb-2 font-medium">Strategy</th>
                  <th className="pb-2 font-medium">Symbol</th>
                  <th className="pb-2 font-medium text-right">Entry</th>
                  <th className="pb-2 font-medium text-right">Current</th>
                  <th className="pb-2 font-medium text-right">P&L</th>
                  <th className="pb-2 font-medium text-right">XIRR</th>
                  <th className="pb-2 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {executions.map(ex => {
                  const exFlows = cashFlows.filter(cf => cf.execution_id === ex.id);
                  const exXirr = calculateExecutionXIRR(exFlows.map(cf => ({
                    date: cf.date,
                    amount: cf.amount,
                    type: cf.type,
                  })));
                  const capitalAllocated = ex.entry_price * ex.quantity;
                  const pnl = (ex.realized_pnl || 0) + (ex.unrealized_pnl || 0);
                  const pnlPct = capitalAllocated > 0 ? (pnl / capitalAllocated) * 100 : 0;
                  
                  return (
                    <tr key={ex.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 font-medium text-slate-800">{ex.strategy_name}</td>
                      <td className="py-2 font-mono text-slate-700">{ex.symbol}</td>
                      <td className="py-2 text-right font-mono text-slate-700">
                        {formatCurrency(ex.entry_filled_price || ex.entry_price, 2)}
                      </td>
                      <td className="py-2 text-right font-mono text-slate-700">
                        {ex.exit_filled_price ? formatCurrency(ex.exit_filled_price, 2) : '—'}
                      </td>
                      <td className="py-2 text-right font-bold">
                        <span className={pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {pnl >= 0 ? '+' : ''}{formatCurrency(pnl, 0)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
                        </span>
                      </td>
                      <td className="py-2 text-right font-mono">
                        {exXirr !== null ? (
                          <span className={exXirr >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                            {formatPct(exXirr, 1)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold capitalize">
                          {ex.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}