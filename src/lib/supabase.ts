import { createClient } from '@supabase/supabase-js';

// Supabase configuration - these should be set in environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type definitions for our database tables
export interface UserProfile {
  id: string;
  user_id: string;
  zerodha_api_key?: string;
  zerodha_api_secret?: string;
  zerodha_access_token?: string;
  zerodha_request_token?: string;
  has_historical_access: boolean;
  total_capital: number;
  risk_per_trade: number;
  paper_trading_mode: boolean;
  created_at: string;
  updated_at: string;
}

export interface Trade {
  id: string;
  user_id: string;
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
  status: 'PENDING' | 'OPEN' | 'CLOSED' | 'CANCELLED' | 'REJECTED';
  entry_time?: string;
  exit_time?: string;
  exit_price?: number;
  realized_pnl?: number;
  unrealized_pnl?: number;
  gtt_order_id_entry?: string;
  gtt_order_id_sl?: string;
  gtt_order_id_target1?: string;
  gtt_order_id_target2?: string;
  paper_trade: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TradeCharges {
  brokerage: number;
  stt: number;
  exchange_fees: number;
  gst: number;
  sebi_fees: number;
  stamp_duty: number;
  total: number;
}

export interface BudgetState {
  total_capital: number;
  available_balance: number;
  allocated_capital: number;
  used_margin: number;
  total_charges_today: number;
  net_available: number;
}

export interface PortfolioAnalytics {
  total_invested: number;
  current_value: number;
  total_realized_pnl: number;
  total_unrealized_pnl: number;
  total_pnl: number;
  cagr: number;
  xirr: number;
  win_rate: number;
  avg_win: number;
  avg_loss: number;
  profit_factor: number;
  max_drawdown: number;
  sharpe_ratio: number;
}