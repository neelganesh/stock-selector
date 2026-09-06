import { createClient } from '@supabase/supabase-js';

// Supabase moved from legacy JWT anon/service_role keys to scoped keys:
//   - Publishable key  (sb_publishable_*) — safe in browser bundles, replaces
//     the old VITE_SUPABASE_ANON_KEY. We accept both names for compatibility
//     with existing deploys, but the Publishable key is the canonical one.
//   - Secret key       (sb_secret_*)    — server-only, never import this file
//     from /api; that code path uses process.env.SUPABASE_SECRET_KEY directly.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn('[Supabase] Credentials not configured. Auth and database features will be disabled.', { supabaseUrl, hasKey: !!supabasePublishableKey });
} else {
  console.log('[Supabase] Client initialized with URL:', supabaseUrl);
}

export const supabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null;

/**
 * The client-side UserProfile type. Mirrors the user_profiles table.
 *
 * NOTE: zerodha_* columns are gone — we use Kite Publisher mode with a
 * single kite_api_key field stored encrypted server-side.
 */
export type UserProfile = {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  paper_trading_enabled: boolean;
  paper_trading_capital: number;
  /** AES-256-GCM ciphertext (v1:iv:tag:ct), never the plaintext. */
  kite_api_key: string | null;
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