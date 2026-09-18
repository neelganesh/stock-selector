-- Store each user's MegaBull paper-trading API key encrypted at rest.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS megabull_api_key TEXT;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_megabull_api_key_len;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_megabull_api_key_len
  CHECK (megabull_api_key IS NULL OR length(megabull_api_key) <= 512);

COMMENT ON COLUMN public.user_profiles.megabull_api_key IS
  'AES-256-GCM encrypted MegaBull paper-trading API key.';
