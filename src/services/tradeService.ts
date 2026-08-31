import { supabase, type Trade, type TradeCharges, type PortfolioAnalytics } from '../lib/supabase';

export interface CreateTradeInput {
  symbol: string;
  name: string;
  segment: 'F&O' | 'CASH';
  strategy_id: string;
  strategy_name: string;
  entry_price: number;
  stop_loss: number;
  target1: number;
  target2?: number;
  quantity: number;
  total_investment: number;
  charges: TradeCharges;
  gtt_order_id_entry?: string;
  gtt_order_id_sl?: string;
  gtt_order_id_target1?: string;
  gtt_order_id_target2?: string;
  paper_trade: boolean;
  notes?: string;
}

export interface UpdateTradeInput {
  status?: Trade['status'];
  exit_price?: number;
  exit_time?: string;
  realized_pnl?: number;
  unrealized_pnl?: number;
  gtt_order_id_entry?: string;
  gtt_order_id_sl?: string;
  gtt_order_id_target1?: string;
  gtt_order_id_target2?: string;
  notes?: string;
}

/**
 * Create a new trade record
 */
export async function createTrade(input: CreateTradeInput): Promise<{ data: Trade | null; error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new Error('Not authenticated') };

  try {
    const { data, error } = await supabase
      .from('trades')
      .insert({
        user_id: user.id,
        ...input,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Update an existing trade
 */
export async function updateTrade(tradeId: string, updates: UpdateTradeInput): Promise<{ data: Trade | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('trades')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', tradeId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Fetch all trades for the current user
 */
export async function fetchTrades(filters?: {
  status?: Trade['status'][];
  strategy_id?: string;
  symbol?: string;
  from_date?: string;
  to_date?: string;
  paper_trade?: boolean;
}): Promise<{ data: Trade[] | null; error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new Error('Not authenticated') };

  try {
    let query = supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (filters?.status?.length) {
      query = query.in('status', filters.status);
    }
    if (filters?.strategy_id) {
      query = query.eq('strategy_id', filters.strategy_id);
    }
    if (filters?.symbol) {
      query = query.eq('symbol', filters.symbol);
    }
    if (filters?.from_date) {
      query = query.gte('created_at', filters.from_date);
    }
    if (filters?.to_date) {
      query = query.lte('created_at', filters.to_date);
    }
    if (filters?.paper_trade !== undefined) {
      query = query.eq('paper_trade', filters.paper_trade);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Fetch a single trade by ID
 */
export async function fetchTrade(tradeId: string): Promise<{ data: Trade | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('id', tradeId)
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Delete a trade (only for paper trades or cancelled trades)
 */
export async function deleteTrade(tradeId: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('trades')
      .delete()
      .eq('id', tradeId);
    
    if (error) throw error;
    return { error: null };
  } catch (err) {
    return { error: err as Error };
  }
}

/**
 * Calculate XIRR (Extended Internal Rate of Return) for a series of cash flows
 * Cash flows: negative for investments, positive for returns
 * Dates: corresponding dates for each cash flow
 */
export function calculateXIRR(cashFlows: number[], dates: Date[]): number {
  if (cashFlows.length !== dates.length || cashFlows.length < 2) return 0;

  // Newton-Raphson method for XIRR
  const guess = 0.1; // 10% initial guess
  const maxIterations = 100;
  const tolerance = 1e-6;

  let rate = guess;
  
  for (let i = 0; i < maxIterations; i++) {
    let f = 0;
    let fPrime = 0;
    
    const baseDate = dates[0];
    
    for (let j = 0; j < cashFlows.length; j++) {
      const daysDiff = (dates[j].getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24);
      const yearsDiff = daysDiff / 365.25;
      
      const factor = Math.pow(1 + rate, yearsDiff);
      f += cashFlows[j] / factor;
      fPrime -= cashFlows[j] * yearsDiff / (factor * (1 + rate));
    }
    
    if (Math.abs(f) < tolerance) break;
    if (fPrime === 0) break;
    
    const newRate = rate - f / fPrime;
    if (Math.abs(newRate - rate) < tolerance) {
      rate = newRate;
      break;
    }
    rate = newRate;
  }

  return rate * 100; // Return as percentage
}

/**
 * Calculate CAGR (Compound Annual Growth Rate)
 */
export function calculateCAGR(initialValue: number, finalValue: number, years: number): number {
  if (initialValue <= 0 || years <= 0) return 0;
  return (Math.pow(finalValue / initialValue, 1 / years) - 1) * 100;
}

/**
 * Calculate comprehensive portfolio analytics
 */
export async function calculatePortfolioAnalytics(): Promise<{ data: PortfolioAnalytics | null; error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new Error('Not authenticated') };

  try {
    const { data: trades, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'CANCELLED')
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (!trades || trades.length === 0) {
      return {
        data: {
          total_invested: 0,
          current_value: 0,
          total_realized_pnl: 0,
          total_unrealized_pnl: 0,
          total_pnl: 0,
          cagr: 0,
          xirr: 0,
          win_rate: 0,
          avg_win: 0,
          avg_loss: 0,
          profit_factor: 0,
          max_drawdown: 0,
          sharpe_ratio: 0,
        },
        error: null,
      };
    }

    // Separate closed and open trades
    const closedTrades = trades.filter(t => t.status === 'CLOSED');
    const openTrades = trades.filter(t => t.status === 'OPEN' || t.status === 'PENDING');

    // Realized P&L
    const totalRealizedPnL = closedTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0);
    
    // Unrealized P&L (would need live prices - using entry as placeholder)
    const totalUnrealizedPnL = openTrades.reduce((sum, t) => sum + (t.unrealized_pnl || 0), 0);
    
    // Total invested
    const totalInvested = trades.reduce((sum, t) => sum + t.total_investment, 0);
    
    // Current value (invested + realized + unrealized)
    const currentValue = totalInvested + totalRealizedPnL + totalUnrealizedPnL;
    const totalPnL = totalRealizedPnL + totalUnrealizedPnL;

    // Win rate
    const winningTrades = closedTrades.filter(t => (t.realized_pnl || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.realized_pnl || 0) < 0);
    const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
    
    // Average win/loss
    const avgWin = winningTrades.length > 0 
      ? winningTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0) / winningTrades.length 
      : 0;
    const avgLoss = losingTrades.length > 0 
      ? losingTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0) / losingTrades.length 
      : 0;
    
    // Profit factor
    const grossProfit = winningTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

    // XIRR calculation
    const cashFlows: number[] = [];
    const dates: Date[] = [];
    
    // Initial investment (negative)
    const firstTrade = trades[0];
    cashFlows.push(-firstTrade.total_investment);
    dates.push(new Date(firstTrade.created_at));
    
    // Each trade's cash flows
    for (const trade of trades) {
      if (trade.status === 'CLOSED' && trade.exit_time && trade.realized_pnl !== undefined) {
        cashFlows.push(trade.total_investment + trade.realized_pnl); // Return of capital + P&L
        dates.push(new Date(trade.exit_time));
      }
    }
    
    // Current value of open positions
    if (openTrades.length > 0) {
      const openValue = openTrades.reduce((sum, t) => sum + t.total_investment + (t.unrealized_pnl || 0), 0);
      cashFlows.push(openValue);
      dates.push(new Date());
    }

    const xirr = calculateXIRR(cashFlows, dates);

    // CAGR calculation
    const firstDate = new Date(trades[0].created_at);
    const years = (Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    const cagr = calculateCAGR(totalInvested, currentValue, years);

    // Max Drawdown (simplified - peak to trough)
    let peak = 0;
    let maxDrawdown = 0;
    let runningPnL = 0;
    
    for (const trade of trades) {
      if (trade.status === 'CLOSED' && trade.realized_pnl !== undefined) {
        runningPnL += trade.realized_pnl;
        if (runningPnL > peak) peak = runningPnL;
        const drawdown = peak - runningPnL;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      }
    }
    const maxDrawdownPct = peak > 0 ? (maxDrawdown / peak) * 100 : 0;

    // Sharpe Ratio (simplified - using daily returns approximation)
    const returns = closedTrades
      .filter(t => t.realized_pnl !== undefined && t.total_investment > 0)
      .map(t => (t.realized_pnl || 0) / t.total_investment);
    
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const stdDev = returns.length > 1 
      ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1))
      : 0;
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized

    return {
      data: {
        total_invested: totalInvested,
        current_value: currentValue,
        total_realized_pnl: totalRealizedPnL,
        total_unrealized_pnl: totalUnrealizedPnL,
        total_pnl: totalPnL,
        cagr,
        xirr,
        win_rate: winRate,
        avg_win: avgWin,
        avg_loss: avgLoss,
        profit_factor: profitFactor,
        max_drawdown: maxDrawdownPct,
        sharpe_ratio: sharpeRatio,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Calculate trading charges for a trade
 */
export function calculateTradeCharges(
  tradeValue: number,
  isDelivery: boolean = false,
  isBuy: boolean = true
): TradeCharges {
  // Zerodha charges (as of 2024)
  const turnover = tradeValue;
  
  // Brokerage
  let brokerage = 0;
  if (isDelivery) {
    brokerage = 0; // Free equity delivery
  } else {
    brokerage = Math.min(20, turnover * 0.0003); // 0.03% or ₹20, whichever is lower
  }

  // STT (Securities Transaction Tax)
  let stt = 0;
  if (isDelivery) {
    stt = turnover * 0.001; // 0.1% on both buy & sell for delivery
  } else {
    stt = isBuy ? 0 : turnover * 0.00025; // 0.025% on sell side only for intraday
  }

  // Exchange transaction charges
  const exchange_fees = turnover * 0.0000345; // NSE: 0.00345%

  // SEBI fees
  const sebi_fees = turnover * 0.000001; // ₹1 per crore

  // Stamp duty (on buy side only)
  const stamp_duty = isBuy ? turnover * 0.00003 : 0; // 0.003%

  // GST (18% on brokerage + exchange fees)
  const gst = (brokerage + exchange_fees) * 0.18;

  const total = brokerage + stt + exchange_fees + gst + sebi_fees + stamp_duty;

  return {
    brokerage: Number(brokerage.toFixed(2)),
    stt: Number(stt.toFixed(2)),
    exchange_fees: Number(exchange_fees.toFixed(2)),
    gst: Number(gst.toFixed(2)),
    sebi_fees: Number(sebi_fees.toFixed(2)),
    stamp_duty: Number(stamp_duty.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}