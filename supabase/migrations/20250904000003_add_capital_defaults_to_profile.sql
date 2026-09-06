-- ============================================
-- ADD CAPITAL DEFAULTS TO USER PROFILE TRIGGER
-- ============================================
-- Updates the handle_new_user trigger to include all capital
-- configuration fields with sensible defaults for new users.
--
-- Defaults:
-- - total_capital: ₹1 Lakh
-- - paper_trading_capital: ₹1 Lakh  
-- - risk_per_trade_pct: 2%
-- - max_position_pct: 10%
-- - max_sector_pct: 25%
-- - daily_loss_limit_pct: 5%
-- - paper_trading_enabled: true
--
-- This ensures the capital API works immediately after signup
-- without requiring the user to configure anything manually.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    user_id, 
    email, 
    full_name,
    total_capital,
    paper_trading_capital,
    risk_per_trade_pct,
    max_position_pct,
    max_sector_pct,
    daily_loss_limit_pct,
    paper_trading_enabled
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    100000,   -- total_capital: ₹1 Lakh
    100000,   -- paper_trading_capital: ₹1 Lakh
    2,        -- risk_per_trade_pct: 2%
    10,       -- max_position_pct: 10%
    25,       -- max_sector_pct: 25%
    5,        -- daily_loss_limit_pct: 5%
    true      -- paper_trading_enabled: true
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
