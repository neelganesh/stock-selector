-- ============================================
-- FIX EXISTING USER PROFILES
-- ============================================
-- Run this script in Supabase SQL Editor to add capital defaults
-- to any existing user profiles that don't have them.
--
-- This fixes the "User profile not found" error for existing users.

UPDATE public.user_profiles
SET 
  total_capital = COALESCE(total_capital, 100000),
  paper_trading_capital = COALESCE(paper_trading_capital, 100000),
  risk_per_trade_pct = COALESCE(risk_per_trade_pct, 2),
  max_position_pct = COALESCE(max_position_pct, 10),
  max_sector_pct = COALESCE(max_sector_pct, 25),
  daily_loss_limit_pct = COALESCE(daily_loss_limit_pct, 5),
  paper_trading_enabled = COALESCE(paper_trading_enabled, true)
WHERE 
  total_capital IS NULL 
  OR paper_trading_capital IS NULL
  OR risk_per_trade_pct IS NULL
  OR max_position_pct IS NULL
  OR max_sector_pct IS NULL
  OR daily_loss_limit_pct IS NULL
  OR paper_trading_enabled IS NULL;

-- Show affected rows
SELECT 'Updated ' || COUNT(*) || ' user profiles' AS result
FROM public.user_profiles
WHERE 
  total_capital IS NULL 
  OR paper_trading_capital IS NULL
  OR risk_per_trade_pct IS NULL;
