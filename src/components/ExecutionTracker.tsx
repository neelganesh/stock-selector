import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { Icon, type IconName } from './Icon';
import { useToast } from './useToast';
import { authFetchJSON, authFetch } from '../lib/authFetch';

interface Execution {
  id: string;
  strategy_id: string;
  strategy_name: string;
  symbol: string;
  exchange: string;
  entry_price: number;
  stop_loss: number;
  target1: number;
  target2: number | null;
  quantity: number;
  product: string;
  risk_amount: number;
  risk_pct: number;
  // capital_allocated is computed client-side: entry_price * quantity
  charges_estimate: any;
  status: string;
  entry_filled_price: number | null;
  entry_filled_at: string | null;
  exit_filled_price: number | null;
  exit_filled_at: string | null;
  total_charges: number | null;
  realized_pnl: number | null;
  created_at: string;
  updated_at: string;
  notes?: string | null;
  tags?: string[] | null;
  cashFlows?: CashFlow[];
}

interface CashFlow {
  id: string;
  execution_id: string;
  flow_type: string;
  amount: number;
  description: string;
  metadata: any;
  created_at: string;
}

interface ExecutionTrackerProps {
  isLoggedIn: boolean;
  isPaperOnly?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: IconName }> = {
  pending: { label: 'Pending Entry', color: 'text-amber-700', bg: 'bg-amber-50', icon: 'clock' },
  entry_placed: { label: 'Entry Placed', color: 'text-blue-700', bg: 'bg-blue-50', icon: 'clock' },
  entry_filled: { label: 'Entry Filled', color: 'text-blue-700', bg: 'bg-blue-50', icon: 'check' },
  gtt_placed: { label: 'GTT Active', color: 'text-indigo-700', bg: 'bg-indigo-50', icon: 'target' },
  target1_hit: { label: 'Target 1 Hit', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: 'target' },
  target2_hit: { label: 'Target 2 Hit', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: 'target' },
  stop_loss_hit: { label: 'Stop Loss Hit', color: 'text-rose-700', bg: 'bg-rose-50', icon: 'stop' },
  manually_exited: { label: 'Exited', color: 'text-slate-700', bg: 'bg-slate-50', icon: 'logout' },
  cancelled: { label: 'Cancelled', color: 'text-slate-500', bg: 'bg-slate-100', icon: 'x' },
  rejected: { label: 'Rejected', color: 'text-rose-700', bg: 'bg-rose-50', icon: 'x' },
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPrice = (value: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(value);
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function ExecutionTracker({ isLoggedIn, isPaperOnly = false }: ExecutionTrackerProps) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const toast = useToast();

  const fetchExecutions = async () => {
    if (!isLoggedIn) {
      setExecutions([]);
      setIsLoading(false);
      return;
    }

    try {
      // Fetch both live executions and paper positions in parallel
      const [liveExecutions, paperPositions] = await Promise.all([
        authFetchJSON<any[]>('/api/executions'),
        authFetchJSON<any[]>('/api/paper-positions'),
      ]);

      // capital_allocated is derived: entry_price * quantity (no DB column needed)
      const executions: Execution[] = liveExecutions;
      for (const p of paperPositions) {
        executions.push({
          id: `paper_${p.id}`,
          strategy_id: p.strategy_id,
          strategy_name: p.strategy_name,
          symbol: p.symbol,
          exchange: 'NSE',
          entry_price: p.entry_price,
          stop_loss: p.stop_loss,
          target1: p.target1,
          target2: p.target2,
          quantity: p.quantity,
          product: 'CNC',
          risk_amount: p.risk_amount,
          risk_pct: p.risk_pct,
          // capital_allocated derived: entry_price * quantity
          charges_estimate: p.charges_estimate,
          status: p.status,
          entry_filled_price: p.entry_filled_price,
          entry_filled_at: p.entry_filled_at,
          exit_filled_price: p.exit_filled_price,
          exit_filled_at: p.exit_filled_at,
          total_charges: p.total_charges,
          realized_pnl: p.realized_pnl,
          created_at: p.created_at,
          updated_at: p.updated_at,
          notes: p.notes,
          tags: p.tags,
        } as Execution);
      }

      setExecutions(executions);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Fetch executions error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExecutions();
    // Poll every 30 seconds
    const interval = setInterval(fetchExecutions, 30000);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  const filteredExecutions = executions.filter((ex) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'open') {
      // Canonical schema enums (strategy_executions + paper_positions).
      // 'pending' (not 'pending_entry'); no 'partial_exit' status exists.
      return ['pending', 'entry_placed', 'entry_filled', 'gtt_placed', 'target1_hit', 'target2_hit'].includes(ex.status);
    }
    if (activeFilter === 'closed') {
      return ['target2_hit', 'stop_loss_hit', 'manually_exited', 'cancelled', 'rejected'].includes(ex.status);
    }
    return true;
  });

  const handleExit = async (execution: Execution, exitPrice: number, status: 'target1_hit' | 'target2_hit' | 'stop_loss_hit' | 'manually_exited') => {
    try {
      const isPaper = execution.id.startsWith('paper_');
      const realId = isPaper ? execution.id.replace('paper_', '') : execution.id;
      const endpoint = isPaper ? `/api/paper-positions/${realId}` : `/api/executions/${execution.id}`;

      const response = await authFetch(endpoint, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          exit_filled_price: exitPrice,
          exit_filled_at: new Date().toISOString(),
        }),
      });
      if (!response.ok) throw new Error('Failed to update execution');
      toast.success(`Position for ${execution.symbol} closed successfully`);
      fetchExecutions();
    } catch (err) {
      console.error('Exit error:', err);
      toast.error('Failed to exit position');
    }
  };

  const handleCancel = async (execution: Execution) => {
    if (!confirm('Cancel this execution?')) return;
    try {
      const isPaper = execution.id.startsWith('paper_');
      const realId = isPaper ? execution.id.replace('paper_', '') : execution.id;
      const endpoint = isPaper ? `/api/paper-positions/${realId}` : `/api/executions/${execution.id}`;

      const response = await authFetch(endpoint, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to cancel execution');
      toast.success(`Execution for ${execution.symbol} cancelled`);
      fetchExecutions();
    } catch (err) {
      console.error('Cancel error:', err);
      toast.error('Failed to cancel execution');
    }
  };

  const getUnrealizedPnL = (execution: Execution) => {
    if (!execution.entry_filled_price || execution.status === 'cancelled') return 0;
    // In a real app, you'd fetch live price here
    // For now, estimate based on targets
    if (execution.status === 'target1_hit') return (execution.target1 - execution.entry_filled_price) * execution.quantity;
    if (execution.status === 'target2_hit') return (execution.target2! - execution.entry_filled_price) * execution.quantity;
    if (execution.status === 'stop_loss_hit') return (execution.stop_loss - execution.entry_filled_price) * execution.quantity;
    return 0;
  };

  if (!isLoggedIn) {
    return (
      <GlassCard variant="default" padding="lg" className="text-center">
        <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4 text-[color:var(--text-tertiary)]">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Strategy Execution Tracker</h3>
        <p className="text-sm text-slate-500">
          Connect Zerodha from the header to track your executed strategies.
        </p>
      </GlassCard>
    );
  }

  if (isLoading && executions.length === 0) {
    return (
      <GlassCard variant="default" padding="lg">
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 rounded-[var(--card-radius)] bg-[color:var(--ground-secondary)] animate-pulse" />
          ))}
        </div>
      </GlassCard>
    );
  }

  const openExecutions = executions.filter((e) => ['pending', 'entry_placed', 'entry_filled', 'gtt_placed', 'target1_hit', 'target2_hit'].includes(e.status));
  const totalPnL = executions.reduce((sum, e) => sum + (e.realized_pnl || 0) + getUnrealizedPnL(e), 0);
  const totalRisk = openExecutions.reduce((sum, e) => sum + e.risk_amount, 0);

  return (
    <GlassCard variant="default" padding="none" className="overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200/60">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Strategy Executions
          </h3>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${totalPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
            </span>
            {lastUpdated && (
              <span
                className="text-[11px] text-slate-400 hidden sm:inline"
                data-testid="executions-last-updated"
                title={lastUpdated.toISOString()}
              >
                Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
            <button
              onClick={fetchExecutions}
              disabled={isLoading}
              aria-label="Refresh executions"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 p-1 rounded-[var(--card-radius)] bg-[color:var(--ground-secondary)] border border-[color:var(--border-subtle)]">
          {(['all', 'open', 'closed'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeFilter === filter
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-extrabold rounded-full bg-slate-200 text-slate-600">
                {filter === 'all' ? executions.length : filteredExecutions.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="px-4 py-3 border-b border-slate-200/60 bg-slate-50/30 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Open Positions</p>
          <p className="font-extrabold text-slate-900">{openExecutions.length}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Risk Deployed</p>
          <p className="font-extrabold text-amber-600">{formatCurrency(totalRisk)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total P&L</p>
          <p className={`font-extrabold ${totalPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
          </p>
        </div>
      </div>

      {/* Executions List */}
      <div className="divide-y divide-slate-200/60">
        {filteredExecutions.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p className="text-slate-500">No executions found</p>
            <p className="text-xs text-slate-400 mt-1">Execute a trade from the signals screener to see it here</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredExecutions.map((execution, index) => (
              <motion.div
                key={execution.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="p-4 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="font-bold text-slate-900">{execution.symbol}</span>
                      {STATUS_CONFIG[execution.status] && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${STATUS_CONFIG[execution.status].color} ${STATUS_CONFIG[execution.status].bg}`}>
                          <Icon name={STATUS_CONFIG[execution.status].icon} size={11} strokeWidth={2.5} />
                          {STATUS_CONFIG[execution.status].label}
                        </span>
                      )}
                      {execution.id.startsWith('paper_') && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-violet-100 text-violet-700 border border-violet-200">
                          <Icon name="note" size={11} strokeWidth={2.5} />
                          PAPER
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{execution.strategy_name}</span>
                      <span className="text-[10px] text-slate-400 ml-auto">{formatDate(execution.created_at)}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="flex flex-col">
                        <span className="text-slate-400">Entry</span>
                        <span className="font-bold text-blue-700">{formatPrice(execution.entry_filled_price || execution.entry_price)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-400">SL</span>
                        <span className="font-bold text-rose-700">{formatPrice(execution.stop_loss)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-400">T1</span>
                        <span className="font-bold text-emerald-700">{formatPrice(execution.target1)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-400">Qty</span>
                        <span className="font-bold text-slate-900">{execution.quantity}</span>
                      </div>
                    </div>

                    {execution.target2 && (
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="flex flex-col">
                          <span className="text-slate-400">T2</span>
                          <span className="font-bold text-emerald-700">{formatPrice(execution.target2)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-slate-400">Risk</span>
                          <span className="font-bold text-amber-600">{formatCurrency(execution.risk_amount)} ({execution.risk_pct}%)</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">
                        {formatCurrency(execution.entry_price * execution.quantity)}
                      </p>
                      <p className="text-[10px] text-slate-400">Capital</p>
                    </div>

                    {execution.realized_pnl !== null && execution.realized_pnl !== 0 && (
                      <div className="text-right">
                        <p className={`text-sm font-bold ${execution.realized_pnl >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {execution.realized_pnl >= 0 ? '+' : ''}{formatCurrency(execution.realized_pnl)}
                        </p>
                        <p className="text-[10px] text-slate-400">Realized P&L</p>
                      </div>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setExpandedId(expandedId === execution.id ? null : execution.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        <svg className={`w-4 h-4 transition-transform ${expandedId === execution.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-3 flex items-center gap-2 pt-3 border-t border-slate-100">
                  {isPaperOnly && !execution.id.startsWith('paper_') && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 whitespace-nowrap">Paper Mode — Real orders disabled</span>
                  )}
                  {isPaperOnly && !execution.id.startsWith('paper_') && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Paper Mode — Real orders disabled</span>
                  )}
                  {['pending', 'entry_filled', 'gtt_placed'].includes(execution.status) && (
                    <>
                      <button
                        onClick={() => handleExit(execution, execution.target1, 'target1_hit')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold hover:bg-emerald-200 transition-colors flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                        T1 Hit
                      </button>
                      {execution.target2 && (
                        <button
                          onClick={() => handleExit(execution, execution.target2!, 'target2_hit')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                          </svg>
                          T2 Hit
                        </button>
                      )}
                      <button
                        onClick={() => handleExit(execution, execution.stop_loss, 'stop_loss_hit')}
                        className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-colors flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        SL Hit
                      </button>
                      <button
                        onClick={() => handleExit(execution, execution.entry_filled_price || execution.entry_price, 'manually_exited')}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Exit
                      </button>
                    </>
                  )}

                  {execution.status === 'pending' && (
                    <button
                      onClick={() => handleCancel(execution)}
                      className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold hover:bg-amber-100 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {/* Expanded Cash Flows */}
                <AnimatePresence>
                  {expandedId === execution.id && execution.cashFlows && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-3 pt-3 border-t border-slate-100 overflow-hidden"
                    >
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Cash Flow History</div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {execution.cashFlows.map((flow) => (
                          <div
                            key={flow.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                flow.flow_type === 'entry' || flow.flow_type === 'entry_order' ? 'bg-rose-100 text-rose-700' :
                                flow.flow_type === 'exit' ? 'bg-emerald-100 text-emerald-700' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {flow.flow_type}
                              </span>
                              <span className="text-slate-600">{flow.description}</span>
                            </div>
                            <span className={`font-bold ${flow.amount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {flow.amount >= 0 ? '+' : ''}{formatCurrency(flow.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </GlassCard>
  );
}