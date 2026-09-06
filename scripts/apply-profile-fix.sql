-- ============================================
-- FIX EXISTING USER PROFILES
-- ============================================
-- Run this in Supabase SQL Editor to:
-- 1. Update the trigger function to include capital defaults
-- 2. Fix all existing profiles that are missing capital fields

-- Step 1: Update the trigger function
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

-- Step 2: Update existing profiles that are missing capital fields
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
  OR risk_per_trade_pct IS NULL;

-- Verify the fix
SELECT 
  'Total profiles' as metric, COUNT(*) as value FROM public.user_profiles
UNION ALL
SELECT 
  'Profiles with capital fields', COUNT(*) 
FROM public.user_profiles 
WHERE total_capital IS NOT NULL;
