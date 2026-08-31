import React, { useState, useEffect, useCallback } from 'react';
import { type Trade, type PortfolioAnalytics } from '../lib/supabase';
import { fetchTrades, calculatePortfolioAnalytics } from '../services/tradeService';
import { useAuth } from '../context/AuthContext';

interface TradeHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TradeHistory: React.FC<TradeHistoryProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [analytics, setAnalytics] = useState<PortfolioAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'history' | 'analytics'>('history');
  const [statusFilter, setStatusFilter] = useState<'all' | Trade['status']>('all');
  const [sortBy, setSortBy] = useState<'date' | 'pnl' | 'symbol'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const [tradesResult, analyticsResult] = await Promise.all([
        fetchTrades(),
        calculatePortfolioAnalytics(),
      ]);
      
      if (tradesResult.data) setTrades(tradesResult.data);
      if (analyticsResult.data) setAnalytics(analyticsResult.data);
    } catch (err) {
      console.error('Error fetching trade data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen) fetchData();
  }, [isOpen, fetchData]);

  const filteredTrades = trades.filter(t => {
    if (statusFilter === 'all') return true;
    return t.status === statusFilter;
  }).sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'date') {
      comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    } else if (sortBy === 'pnl') {
      comparison = (a.realized_pnl || 0) - (b.realized_pnl || 0);
    } else if (sortBy === 'symbol') {
      comparison = a.symbol.localeCompare(b.symbol);
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const formatCurrency = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    if (Math.abs(value) >= 1e7) return `${sign}₹${(value / 1e7).toFixed(2)} Cr`;
    if (Math.abs(value) >= 1e5) return `${sign}₹${(value / 1e5).toFixed(2)} L`;
    if (Math.abs(value) >= 1e3) return `${sign}₹${(value / 1e3).toFixed(2)} K`;
    return `${sign}₹${value.toFixed(0)}`;
  };

  const formatPercent = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const getStatusColor = (status: Trade['status']): string => {
    switch (status) {
      case 'OPEN': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'CLOSED': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'PENDING': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'CANCELLED': return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
      case 'REJECTED': return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-6xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
          <div>
            <h2 className="text-xl font-bold text-white">Trade History & Analytics</h2>
            <p className="text-xs text-slate-400 mt-0.5">Complete trade tracking with CAGR/XIRR analytics</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors disabled:opacity-50"
            >
              Refresh
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 px-4">
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            Trade History ({trades.length})
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'analytics'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            Analytics
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'history' ? (
            <TradeHistoryTab
              trades={filteredTrades}
              loading={loading}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              sortBy={sortBy}
              setSortBy={setSortBy}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              formatCurrency={formatCurrency}
              formatPercent={formatPercent}
              getStatusColor={getStatusColor}
            />
          ) : (
            <AnalyticsTab analytics={analytics} loading={loading} formatCurrency={formatCurrency} formatPercent={formatPercent} />
          )}
        </div>
      </div>
    </div>
  );
};

interface TradeHistoryTabProps {
  trades: Trade[];
  loading: boolean;
  statusFilter: 'all' | Trade['status'];
  setStatusFilter: (filter: 'all' | Trade['status']) => void;
  sortBy: 'date' | 'pnl' | 'symbol';
  setSortBy: (sort: 'date' | 'pnl' | 'symbol') => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (order: 'asc' | 'desc') => void;
  formatCurrency: (value: number) => string;
  formatPercent: (value: number) => string;
  getStatusColor: (status: Trade['status']) => string;
}

const TradeHistoryTab: React.FC<TradeHistoryTabProps> = ({
  trades,
  loading,
  statusFilter,
  setStatusFilter,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  formatCurrency,
  formatPercent,
  getStatusColor,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading trades...
        </div>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg font-medium">No trades yet</p>
          <p className="text-sm mt-1">Execute trades from the Position Sizing Calculator to see them here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-xs font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | Trade['status'])}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="all">All</option>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
            <option value="PENDING">Pending</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-xs font-medium">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'pnl' | 'symbol')}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="date">Date</option>
            <option value="pnl">P&L</option>
            <option value="symbol">Symbol</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={sortOrder === 'asc' ? 'Descending' : 'Ascending'}
          >
            <svg className={`w-4 h-4 ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Trade List */}
      <div className="space-y-2">
        {trades.map((trade) => (
          <TradeCard
            key={trade.id}
            trade={trade}
            formatCurrency={formatCurrency}
            formatPercent={formatPercent}
            getStatusColor={getStatusColor}
          />
        ))}
      </div>
    </div>
  );
};

interface TradeCardProps {
  trade: Trade;
  formatCurrency: (value: number) => string;
  formatPercent: (value: number) => string;
  getStatusColor: (status: Trade['status']) => string;
}

const TradeCard: React.FC<TradeCardProps> = ({ trade, formatCurrency, formatPercent, getStatusColor }) => {
  const pnl = (trade.realized_pnl || 0) + (trade.unrealized_pnl || 0);
  const pnlPercent = trade.total_investment > 0 ? (pnl / trade.total_investment) * 100 : 0;
  const isPaper = trade.paper_trade;

  return (
    <div className="bg-slate-950/60 rounded-xl border border-slate-800 overflow-hidden">
      {/* Main Row */}
      <div className="p-4 grid grid-cols-12 gap-4 items-center">
        <div className="col-span-12 md:col-span-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
              <span className="font-bold text-white text-sm">{trade.symbol.slice(0, 2)}</span>
            </div>
            <div>
              <div className="font-bold text-white text-sm">{trade.symbol}</div>
              <div className="text-[11px] text-slate-400">{trade.name}</div>
            </div>
          </div>
        </div>

        <div className="col-span-6 md:col-span-2 text-center md:text-left">
          <div className="text-[10px] text-slate-500 uppercase font-medium">Entry</div>
          <div className="font-mono text-white text-sm">₹{trade.entry_price.toFixed(2)}</div>
          <div className="text-[10px] text-slate-500 uppercase font-medium mt-1">SL</div>
          <div className="font-mono text-rose-400 text-sm">₹{trade.stop_loss.toFixed(2)}</div>
        </div>

        <div className="col-span-6 md:col-span-2 text-center md:text-left">
          <div className="text-[10px] text-slate-500 uppercase font-medium">T1 / T2</div>
          <div className="font-mono text-blue-400 text-sm">₹{trade.target1.toFixed(2)}</div>
          {trade.target2 && (
            <div className="text-[10px] text-indigo-300 font-mono mt-0.5">₹{trade.target2.toFixed(2)}</div>
          )}
        </div>

        <div className="col-span-6 md:col-span-2 text-center md:text-left">
          <div className="text-[10px] text-slate-500 uppercase font-medium">Qty / Invest</div>
          <div className="font-mono text-white text-sm">{trade.quantity.toLocaleString('en-IN')}</div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{formatCurrency(trade.total_investment)}</div>
        </div>

        <div className="col-span-12 md:col-span-3 text-right md:text-left">
          <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${getStatusColor(trade.status)}`}>
            {trade.status}
          </span>
          {isPaper && (
            <span className="ml-2 px-2 py-1 rounded-full text-[10px] font-bold border border-amber-500/30 bg-amber-500/10 text-amber-400">
              PAPER
            </span>
          )}
          <div className={`mt-2 font-mono text-sm ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatCurrency(pnl)} ({formatPercent(pnlPercent)})
          </div>
        </div>
      </div>

      {/* Details Row */}
      <div className="px-4 pb-4 border-t border-slate-800/50 grid grid-cols-12 gap-4 text-[11px]">
        <div className="col-span-6 md:col-span-3">
          <span className="text-slate-500">Strategy:</span>
          <span className="text-slate-300 ml-2 font-medium">{trade.strategy_name}</span>
        </div>
        <div className="col-span-6 md:col-span-3">
          <span className="text-slate-500">Segment:</span>
          <span className="text-slate-300 ml-2 font-medium">{trade.segment}</span>
        </div>
        <div className="col-span-6 md:col-span-3">
          <span className="text-slate-500">Charges:</span>
          <span className="text-rose-300 ml-2 font-mono">{formatCurrency(trade.charges?.total || 0)}</span>
        </div>
        <div className="col-span-6 md:col-span-3 text-right md:text-left">
          <span className="text-slate-500">Date:</span>
          <span className="text-slate-300 ml-2">{new Date(trade.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
};

interface AnalyticsTabProps {
  analytics: PortfolioAnalytics | null;
  loading: boolean;
  formatCurrency: (value: number) => string;
  formatPercent: (value: number) => string;
}

const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ analytics, loading, formatCurrency, formatPercent }) => {
  if (loading || !analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading analytics...
        </div>
      </div>
    );
  }

  const metrics = [
    { label: 'Total Invested', value: formatCurrency(analytics.total_invested), color: 'text-blue-400' },
    { label: 'Current Value', value: formatCurrency(analytics.current_value), color: 'text-emerald-400' },
    { label: 'Total P&L', value: formatCurrency(analytics.total_pnl), color: analytics.total_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400' },
    { label: 'Realized P&L', value: formatCurrency(analytics.total_realized_pnl), color: analytics.total_realized_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400' },
    { label: 'Unrealized P&L', value: formatCurrency(analytics.total_unrealized_pnl), color: analytics.total_unrealized_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400' },
    { label: 'CAGR', value: formatPercent(analytics.cagr), color: analytics.cagr >= 0 ? 'text-emerald-400' : 'text-rose-400' },
    { label: 'XIRR', value: formatPercent(analytics.xirr), color: analytics.xirr >= 0 ? 'text-emerald-400' : 'text-rose-400' },
    { label: 'Win Rate', value: formatPercent(analytics.win_rate), color: analytics.win_rate >= 50 ? 'text-emerald-400' : 'text-rose-400' },
    { label: 'Avg Win', value: formatCurrency(analytics.avg_win), color: 'text-emerald-400' },
    { label: 'Avg Loss', value: formatCurrency(analytics.avg_loss), color: 'text-rose-400' },
    { label: 'Profit Factor', value: analytics.profit_factor.toFixed(2), color: analytics.profit_factor > 1 ? 'text-emerald-400' : 'text-rose-400' },
    { label: 'Max Drawdown', value: formatPercent(analytics.max_drawdown), color: 'text-rose-400' },
    { label: 'Sharpe Ratio', value: analytics.sharpe_ratio.toFixed(2), color: analytics.sharpe_ratio > 1 ? 'text-emerald-400' : 'text-rose-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <div key={index} className="bg-slate-950/60 p-5 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider mb-2">
              {metric.label}
            </div>
            <div className={`font-bold text-lg font-mono ${metric.color}`}>
              {metric.value}
            </div>
          </div>
        ))}
      </div>

      {/* Explanation */}
      <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-sm text-slate-400 space-y-2">
        <div className="font-medium text-slate-300">Metrics Explanation</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
          <div><span className="font-medium text-slate-300">CAGR:</span> Compound Annual Growth Rate - annualized return over the investment period</div>
          <div><span className="font-medium text-slate-300">XIRR:</span> Extended Internal Rate of Return - accounts for irregular cash flow timing</div>
          <div><span className="font-medium text-slate-300">Win Rate:</span> Percentage of closed trades with positive P&L</div>
          <div><span className="font-medium text-slate-300">Profit Factor:</span> Gross Profit / Gross Loss ({'>'}1 is profitable)</div>
          <div><span className="font-medium text-slate-300">Max Drawdown:</span> Largest peak-to-trough decline in equity</div>
          <div><span className="font-medium text-slate-300">Sharpe Ratio:</span> Risk-adjusted return ({'>'}1 is good, {'>'}2 is excellent)</div>
        </div>
      </div>
    </div>
  );
};