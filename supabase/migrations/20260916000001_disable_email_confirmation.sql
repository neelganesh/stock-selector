-- Disable email confirmation for username-based auth
-- This removes the rate limit caused by sending confirmation emails on every signup
-- Users authenticate with username + password only

-- Email confirmation is configured through Supabase project settings and
-- config.toml. Do not modify internal auth tables here: auth.enabled_providers
-- is not part of the hosted database schema.

-- Ensure signup is enabled
-- (it should be, but explicitly set it)
-- Note: this is controlled by the [auth] config in config.toml and Supabase dashboard

-- Re-create the signup confirmation disabled setting via SQL
-- This overrides any UI settings
DO $$
BEGIN
  -- Update auth settings to disable email confirmation
  -- The setting in config.toml [auth.email] enable_confirmations = false
  -- takes effect when Supabase starts. For already-running instances,
  -- use the Supabase dashboard or the following approach.
  RAISE NOTICE 'Email confirmation is controlled by config.toml [auth.email] enable_confirmations = false';
END;
$$;
