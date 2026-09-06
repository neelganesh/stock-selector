-- Encrypt the Kite publisher API key at rest.
--
-- We store the ciphertext directly in the existing `kite_api_key` column
-- (no new column, no schema-level encryption that the JS client can't read).
-- The format is:
--
--   v1:<base64(iv)>:<base64(authTag)>:<base64(ciphertext)>
--
-- where `v1` lets us version the encryption scheme (AES-256-GCM today,
-- could be AES-256-GCM-SIV or a KMS-wrapped DEK tomorrow). The 32-byte
-- key lives only in `KITE_KEY_ENCRYPTION_KEY` on the Vercel function and
-- is never sent to the browser.
--
-- The pre-v1 plaintext rows already in the table from the early Kite
-- Connection UI are wiped to NULL — users will re-enter their key. A
-- single re-encryption pass is safer than auto-upgrading legacy plaintext
-- through a server we can't audit.

UPDATE user_profiles
SET kite_api_key = NULL
WHERE kite_api_key IS NOT NULL
  AND kite_api_key NOT LIKE 'v1:%';

-- Defensive: cap length so a runaway write can't bloat the row. The
-- encrypted blob is ~120 bytes for a 32-char key, so 512 is generous.
ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_kite_api_key_len;
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_kite_api_key_len
  CHECK (kite_api_key IS NULL OR length(kite_api_key) <= 512);

-- Add a comment so future migrations know what the format is.
COMMENT ON COLUMN user_profiles.kite_api_key IS
  'AES-256-GCM encrypted Kite Publisher API key. Format: v1:<iv_b64>:<tag_b64>:<ct_b64>. Plaintext rows are wiped by 20250906000000_encrypt_kite_api_key.sql — users must re-enter.';
