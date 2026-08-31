import React, { useState, useEffect, useCallback } from 'react';
import { supabase, type BudgetState, type TradeCharges } from '../lib/supabase';
import { getKiteCredentials } from '../services/kiteService';
import { useAuth } from '../context/AuthContext';

interface BudgetBarProps {
  onBudgetChange?: (budget: BudgetState) => void;
}

export const BudgetBar: React.FC<BudgetBarProps> = ({ onBudgetChange }) => {
  const { user, profile, refreshProfile } = useAuth();
  const [budget, setBudget] = useState<BudgetState>({
    total_capital: 500000,
    available_balance: 0,
    allocated_capital: 0,
    used_margin: 0,
    total_charges_today: 0,
    net_available: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch live Zerodha margins/balance
  const fetchZerodhaBalance = useCallback(async (): Promise<number> => {
    const creds = getKiteCredentials();
    if (!creds.apiKey || !(creds.accessToken || creds.requestToken)) {
      return 0;
    }

    const token = creds.accessToken || creds.requestToken;
    
    try {
      // Try direct API call first
      const response = await fetch('https://api.kite.trade/user/margins', {
        headers: {
          'X-Kite-Version': '3',
          'Authorization': `token ${creds.apiKey}:${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.data?.equity) {
          // Return available cash balance
          return Number(data.data.equity.available?.cash || 0);
        }
      }
    } catch (err) {
      console.warn('Direct Kite API call failed (CORS):', err);
    }

    // Fallback: Use Vercel proxy if configured
    try {
      const proxyResponse = await fetch('/api/kite/user/margins', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (proxyResponse.ok) {
        const data = await proxyResponse.json();
        if (data.data?.equity) {
          return Number(data.data.equity.available?.cash || 0);
        }
      }
    } catch (err) {
      console.warn('Proxy Kite API call failed:', err);
    }

    return 0;
  }, []);

  // Fetch allocated capital from open trades
  const fetchAllocatedCapital = useCallback(async (): Promise<number> => {
    if (!user) return 0;
    
    try {
      const { data, error } = await supabase
        .from('trades')
        .select('total_investment, status')
        .eq('user_id', user.id)
        .in('status', ['PENDING', 'OPEN']);

      if (error) throw error;
      
      return data?.reduce((sum, trade) => sum + Number(trade.total_investment), 0) || 0;
    } catch (err) {
      console.error('Error fetching allocated capital:', err);
      return 0;
    }
  }, [user, supabase]);

  // Fetch today's charges
  const fetchTodaysCharges = useCallback(async (): Promise<number> => {
    if (!user) return 0;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('trades')
        .select('charges')
        .eq('user_id', user.id)
        .gte('created_at', today);

      if (error) throw error;
      
      return data?.reduce((sum, trade) => {
        const charges = trade.charges as TradeCharges;
        return sum + (charges?.total || 0);
      }, 0) || 0;
    } catch (err) {
      console.error('Error fetching today charges:', err);
      return 0;
    }
  }, [user, supabase]);

  // Refresh all budget data
  const refreshBudget = useCallback(async () => {
    if (!user || !profile) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const [zerodhaBalance, allocatedCapital, todaysCharges] = await Promise.all([
        fetchZerodhaBalance(),
        fetchAllocatedCapital(),
        fetchTodaysCharges(),
      ]);

      const totalCapital = profile.total_capital || 500000;
      const availableBalance = zerodhaBalance > 0 ? zerodhaBalance : totalCapital;
      const usedMargin = allocatedCapital;
      const netAvailable = availableBalance - usedMargin - todaysCharges;

      const newBudget: BudgetState = {
        total_capital: totalCapital,
        available_balance: availableBalance,
        allocated_capital: allocatedCapital,
        used_margin: usedMargin,
        total_charges_today: todaysCharges,
        net_available: Math.max(0, netAvailable),
      };

      setBudget(newBudget);
      setLastUpdated(new Date());
      onBudgetChange?.(newBudget);
    } catch (err) {
      console.error('Error refreshing budget:', err);
      setError('Failed to fetch live balance');
    } finally {
      setLoading(false);
    }
  }, [user, profile, fetchZerodhaBalance, fetchAllocatedCapital, fetchTodaysCharges, onBudgetChange]);

  // Initial load and auto-refresh every 30 seconds
  useEffect(() => {
    if (user && profile) {
      refreshBudget();
      const interval = setInterval(refreshBudget, 30000);
      return () => clearInterval(interval);
    }
  }, [user, profile, refreshBudget]);

  // Format currency
  const formatCurrency = (value: number): string => {
    if (value >= 1e7) return `₹${(value / 1e7).toFixed(2)} Cr`;
    if (value >= 1e5) return `₹${(value / 1e5).toFixed(2)} L`;
    if (value >= 1e3) return `₹${(value / 1e3).toFixed(2)} K`;
    return `₹${value.toFixed(0)}`;
  };

  if (loading && budget.total_capital === 500000) {
    return (
      <div className="fixed top-4 right-4 z-40 w-72 bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-xl animate-in slide-in-from-right duration-300">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading budget...
        </div>
      </div>
    );
  }

  const utilizationPercent = budget.total_capital > 0 
    ? ((budget.allocated_capital + budget.total_charges_today) / budget.total_capital) * 100 
    : 0;

  return (
    <div className="fixed top-4 right-4 z-40 w-72 bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-xl vision-glass animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="font-semibold text-white text-sm">Budget Bar</span>
          {profile?.paper_trading_mode && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded">PAPER</span>
          )}
        </div>
        <button
          onClick={refreshBudget}
          disabled={loading}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          title="Refresh balance"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-3 p-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs">
          {error} — Using configured capital
        </div>
      )}

      {/* Main Budget Metrics */}
      <div className="space-y-3">
        {/* Total Capital */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-xs">Total Capital</span>
          <span className="font-bold text-white text-sm">{formatCurrency(budget.total_capital)}</span>
        </div>

        {/* Available Balance (Live from Zerodha) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-xs">Available Balance</span>
            {budget.available_balance > 0 && budget.available_balance !== budget.total_capital && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded">LIVE</span>
            )}
          </div>
          <span className="font-bold text-emerald-400 text-sm">{formatCurrency(budget.available_balance)}</span>
        </div>

        {/* Allocated Capital */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-xs">Allocated (Open Trades)</span>
          <span className="font-bold text-blue-400 text-sm">{formatCurrency(budget.allocated_capital)}</span>
        </div>

        {/* Today's Charges */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-xs">Charges Today</span>
          <span className="font-bold text-rose-400 text-sm">{formatCurrency(budget.total_charges_today)}</span>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-800 my-1"></div>

        {/* Net Available */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-slate-300 text-sm font-medium">Net Available</span>
          <span className={`font-bold text-lg ${budget.net_available >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatCurrency(budget.net_available)}
          </span>
        </div>

        {/* Utilization Bar */}
        <div className="pt-1">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-400">Utilization</span>
            <span className="font-medium text-white">{utilizationPercent.toFixed(1)}%</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                utilizationPercent >= 90 ? 'bg-rose-500' : 
                utilizationPercent >= 70 ? 'bg-amber-500' : 
                'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, utilizationPercent)}%` }}
            ></div>
          </div>
        </div>

        {/* Last Updated */}
        {lastUpdated && (
          <div className="text-[10px] text-slate-500 text-right pt-1">
            Updated: {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-4 pt-3 border-t border-slate-800 flex gap-2">
        <button
          onClick={() => refreshProfile()}
          className="flex-1 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
        >
          Sync Profile
        </button>
        <button
          onClick={refreshBudget}
          disabled={loading}
          className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
    </div>
  );
};