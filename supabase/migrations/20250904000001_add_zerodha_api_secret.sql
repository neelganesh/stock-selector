-- Add zerodha_api_secret column to user_profiles
-- Each user provides their own Zerodha Kite API key + secret
-- These are used by the backend to compute the SHA256 checksum when
-- exchanging the OAuth request_token for an access_token.
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS zerodha_api_secret TEXT;
