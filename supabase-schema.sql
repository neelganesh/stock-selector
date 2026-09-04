-- Supabase Database Schema for Stock Selector
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TRIGGER FUNCTION: updated_at
-- (defined first so all table triggers can reference it)
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================
-- USER PROFILES TABLE
-- ============================================
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  
  -- Capital & Risk Configuration
  total_capital NUMERIC(15, 2) NOT NULL DEFAULT 1000000,
  risk_per_trade_pct NUMERIC(5, 2) NOT NULL DEFAULT 1.00,
  max_position_pct NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
  max_sector_pct NUMERIC(5, 2) NOT NULL DEFAULT 25.00,
  max_open_strategies INTEGER NOT NULL DEFAULT 10,
  daily_loss_limit_pct NUMERIC(5, 2) NOT NULL DEFAULT 3.00,
  
  -- Paper Trading
  paper_trading_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  paper_trading_capital NUMERIC(15, 2) NOT NULL DEFAULT 1000000,
  
  -- Zerodha Credentials (encrypted at rest via Supabase Vault or app-level encryption)
  zerodha_api_key TEXT,
  zerodha_api_secret TEXT,
  zerodha_access_token TEXT,
  zerodha_access_token_expires_at TIMESTAMPTZ,
  zerodha_user_id TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- STRATEGY EXECUTIONS TABLE
-- ============================================
CREATE TABLE strategy_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Strategy Info
  strategy_id TEXT NOT NULL,
  strategy_name TEXT NOT NULL,
  
  -- Stock Info
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  sector TEXT NOT NULL,
  cap_category TEXT NOT NULL CHECK (cap_category IN ('large', 'mid', 'small')),
  
  -- Trade Parameters
  entry_price NUMERIC(15, 2) NOT NULL,
  stop_loss NUMERIC(15, 2) NOT NULL,
  target1 NUMERIC(15, 2) NOT NULL,
  target2 NUMERIC(15, 2),
  quantity INTEGER NOT NULL,
  risk_amount NUMERIC(15, 2) NOT NULL,
  risk_pct NUMERIC(5, 2) NOT NULL,
  charges_estimate NUMERIC(15, 2) NOT NULL DEFAULT 0,
  
  -- Status Tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'entry_placed', 'entry_filled', 'gtt_placed', 
    'target1_hit', 'target2_hit', 'stop_loss_hit', 
    'manually_exited', 'cancelled', 'rejected'
  )),
  
  -- Order References
  entry_order_id TEXT,
  entry_order_variety TEXT,
  gtt_id TEXT,
  exit_order_id TEXT,
  
  -- Fill Details
  entry_filled_at TIMESTAMPTZ,
  exit_filled_at TIMESTAMPTZ,
  entry_filled_price NUMERIC(15, 2),
  exit_filled_price NUMERIC(15, 2),
  
  -- P&L
  realized_pnl NUMERIC(15, 2),
  unrealized_pnl NUMERIC(15, 2),
  total_charges NUMERIC(15, 2),
  
  -- Notes & Tags
  notes TEXT,
  tags TEXT[],
  
  -- Paper Trading Flag
  is_paper_trade BOOLEAN NOT NULL DEFAULT FALSE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_strategy_executions_user_id ON strategy_executions(user_id);
CREATE INDEX idx_strategy_executions_status ON strategy_executions(status);
CREATE INDEX idx_strategy_executions_symbol ON strategy_executions(symbol);
CREATE INDEX idx_strategy_executions_created_at ON strategy_executions(created_at DESC);

-- Enable RLS
ALTER TABLE strategy_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own executions" ON strategy_executions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own executions" ON strategy_executions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own executions" ON strategy_executions
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- PAPER POSITIONS TABLE (for paper trading virtual portfolio)
-- ============================================
CREATE TABLE paper_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Strategy Info
  strategy_id TEXT NOT NULL,
  strategy_name TEXT NOT NULL,
  
  -- Stock Info
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  sector TEXT NOT NULL,
  cap_category TEXT NOT NULL CHECK (cap_category IN ('large', 'mid', 'small')),
  
  -- Trade Parameters
  entry_price NUMERIC(15, 2) NOT NULL,
  stop_loss NUMERIC(15, 2) NOT NULL,
  target1 NUMERIC(15, 2) NOT NULL,
  target2 NUMERIC(15, 2),
  quantity INTEGER NOT NULL,
  risk_amount NUMERIC(15, 2) NOT NULL,
  risk_pct NUMERIC(5, 2) NOT NULL,
  charges_estimate NUMERIC(15, 2) NOT NULL DEFAULT 0,
  
  -- Status Tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'entry_filled', 'target1_hit', 'target2_hit', 'stop_loss_hit', 
    'manually_exited', 'cancelled', 'rejected'
  )),
  
  -- Fill Details
  entry_filled_at TIMESTAMPTZ,
  exit_filled_at TIMESTAMPTZ,
  entry_filled_price NUMERIC(15, 2),
  exit_filled_price NUMERIC(15, 2),
  
  -- P&L
  realized_pnl NUMERIC(15, 2),
  unrealized_pnl NUMERIC(15, 2),
  total_charges NUMERIC(15, 2),
  
  -- Notes & Tags
  notes TEXT,
  tags TEXT[],
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_paper_positions_user_id ON paper_positions(user_id);
CREATE INDEX idx_paper_positions_status ON paper_positions(status);
CREATE INDEX idx_paper_positions_symbol ON paper_positions(symbol);
CREATE INDEX idx_paper_positions_created_at ON paper_positions(created_at DESC);

-- Enable RLS
ALTER TABLE paper_positions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own paper positions" ON paper_positions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own paper positions" ON paper_positions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own paper positions" ON paper_positions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own paper positions" ON paper_positions
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_paper_positions_updated_at
  BEFORE UPDATE ON paper_positions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TRADE CASH FLOWS TABLE (for XIRR calculation)
-- ============================================
CREATE TABLE trade_cash_flows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_id UUID NOT NULL REFERENCES strategy_executions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  type TEXT NOT NULL CHECK (type IN ('entry', 'exit', 'charge', 'dividend')),
  amount NUMERIC(15, 2) NOT NULL, -- negative for outflows, positive for inflows
  date TIMESTAMPTZ NOT NULL,
  description TEXT NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_trade_cash_flows_execution_id ON trade_cash_flows(execution_id);
CREATE INDEX idx_trade_cash_flows_user_id ON trade_cash_flows(user_id);
CREATE INDEX idx_trade_cash_flows_date ON trade_cash_flows(date);

-- Enable RLS
ALTER TABLE trade_cash_flows ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own cash flows" ON trade_cash_flows
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cash flows" ON trade_cash_flows
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- CAPITAL SNAPSHOTS TABLE (for portfolio tracking)
-- ============================================
CREATE TABLE capital_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  total_capital NUMERIC(15, 2) NOT NULL,
  available_margin NUMERIC(15, 2) NOT NULL,
  deployed_capital NUMERIC(15, 2) NOT NULL,
  risk_used_pct NUMERIC(5, 2) NOT NULL,
  open_positions_count INTEGER NOT NULL,
  
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, snapshot_date)
);

-- Indexes
CREATE INDEX idx_capital_snapshots_user_id ON capital_snapshots(user_id);
CREATE INDEX idx_capital_snapshots_date ON capital_snapshots(snapshot_date DESC);

-- Enable RLS
ALTER TABLE capital_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own snapshots" ON capital_snapshots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own snapshots" ON capital_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- (function already defined at top of file)
-- ============================================
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_strategy_executions_updated_at
  BEFORE UPDATE ON strategy_executions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to calculate XIRR (requires iterative approximation)
-- This is a simplified version; for production, consider a more robust implementation
CREATE OR REPLACE FUNCTION calculate_xirr(p_user_id UUID, p_start_date DATE DEFAULT NULL)
RETURNS NUMERIC AS $$
DECLARE
  v_result NUMERIC;
  v_cash_flows RECORD;
  v_guess NUMERIC := 0.1;
  v_tolerance NUMERIC := 0.0001;
  v_max_iterations INTEGER := 100;
  v_npv NUMERIC;
  v_derivative NUMERIC;
  v_new_guess NUMERIC;
  v_days_diff INTEGER;
BEGIN
  -- Get all cash flows for the user
  FOR v_cash_flows IN 
    SELECT amount, date 
    FROM trade_cash_flows 
    WHERE user_id = p_user_id 
    AND (p_start_date IS NULL OR date >= p_start_date)
    ORDER BY date
  LOOP
    -- Newton-Raphson method for XIRR
    -- This is a placeholder; actual implementation would be more complex
    NULL;
  END LOOP;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's current capital status
CREATE OR REPLACE FUNCTION get_user_capital_status(p_user_id UUID)
RETURNS TABLE (
  total_capital NUMERIC,
  available_margin NUMERIC,
  deployed_capital NUMERIC,
  risk_used_pct NUMERIC,
  open_positions_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.total_capital,
    COALESCE(cs.available_margin, 0) as available_margin,
    COALESCE(cs.deployed_capital, 0) as deployed_capital,
    COALESCE(cs.risk_used_pct, 0) as risk_used_pct,
    COALESCE(cs.open_positions_count, 0) as open_positions_count
  FROM user_profiles up
  LEFT JOIN LATERAL (
    SELECT * FROM capital_snapshots 
    WHERE user_id = p_user_id 
    ORDER BY snapshot_date DESC 
    LIMIT 1
  ) cs ON true
  WHERE up.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;
-- ============================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ============================================
-- This trigger creates a default user_profiles row whenever a new
-- auth.users row is inserted. It is idempotent — if the client also
-- inserts a profile (e.g. during signup), the ON CONFLICT clause
-- skips the duplicate.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL)
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
