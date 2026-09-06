-- Rename zerodha columns to kite for Publisher mode
ALTER TABLE IF EXISTS user_profiles 
  RENAME COLUMN zerodha_api_key TO kite_api_key;

ALTER TABLE IF EXISTS user_profiles 
  DROP COLUMN IF EXISTS zerodha_api_secret;

ALTER TABLE IF EXISTS user_profiles 
  DROP COLUMN IF EXISTS zerodha_access_token_expires_at;