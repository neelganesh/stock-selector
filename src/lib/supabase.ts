import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Auth and database features will be disabled.');
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export type UserProfile = {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  total_capital: number;
  risk_per_trade_pct: number;
  max_position_pct: number;
  max_sector_pct: number;
  max_open_strategies: number;
  daily_loss_limit_pct: number;
  paper_trading_enabled: boolean;
  paper_trading_capital: number;
  zerodha_api_key: string | null;
  zerodha_access_token: string | null;
  zerodha_access_token_expires_at: string | null;
  zerodha_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PaperPosition = {
  id: string;
  user_id: string;
  strategy_id: string;
  strategy_name: string;
  symbol: string;
  name: string;
  sector: string;
  cap_category: 'large' | 'mid' | 'small';
  entry_price: number;
  stop_loss: number;
  target1: number;
  target2: number | null;
  quantity: number;
  risk_amount: number;
  risk_pct: number;
  charges_estimate: number;
  status: 'pending' | 'entry_filled' | 'target1_hit' | 'target2_hit' | 'stop_loss_hit' | 'manually_exited' | 'cancelled' | 'rejected';
  entry_filled_at: string | null;
  exit_filled_at: string | null;
  entry_filled_price: number | null;
  exit_filled_price: number | null;
  realized_pnl: number | null;
  unrealized_pnl: number | null;
  total_charges: number | null;
  notes: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};

export type StrategyExecution = {
  id: string;
  user_id: string;
  strategy_id: string;
  strategy_name: string;
  symbol: string;
  name: string;
  sector: string;
  cap_category: 'large' | 'mid' | 'small';
  entry_price: number;
  stop_loss: number;
  target1: number;
  target2: number | null;
  quantity: number;
  risk_amount: number;
  risk_pct: number;
  charges_estimate: number;
  status: 'pending' | 'entry_placed' | 'entry_filled' | 'gtt_placed' | 'target1_hit' | 'target2_hit' | 'stop_loss_hit' | 'manually_exited' | 'cancelled' | 'rejected';
  entry_order_id: string | null;
  entry_order_variety: string | null;
  gtt_id: string | null;
  exit_order_id: string | null;
  entry_filled_at: string | null;
  exit_filled_at: string | null;
  entry_filled_price: number | null;
  exit_filled_price: number | null;
  realized_pnl: number | null;
  unrealized_pnl: number | null;
  total_charges: number | null;
  notes: string | null;
  tags: string[] | null;
  is_paper_trade: boolean;
  created_at: string;
  updated_at: string;
};

export type TradeCashFlow = {
  id: string;
  execution_id: string;
  user_id: string;
  type: 'entry' | 'exit' | 'charge' | 'dividend';
  amount: number;
  date: string;
  description: string;
  created_at: string;
};

export type CapitalSnapshot = {
  id: string;
  user_id: string;
  total_capital: number;
  available_margin: number;
  deployed_capital: number;
  risk_used_pct: number;
  open_positions_count: number;
  snapshot_date: string;
  created_at: string;
};