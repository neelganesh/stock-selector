import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, UnauthorizedError, getSupabaseAdmin } from '../_auth.js';
import { encrypt, isValidKiteKeyFormat, CryptoError } from '../_crypto.js';

/**
 * POST /api/kite/save-key
 *
 * Body: { api_key: string }
 *
 * Validates the Kite publisher API key format, encrypts it with AES-256-GCM
 * (key from KITE_KEY_ENCRYPTION_KEY env var), and stores the ciphertext
 * in `user_profiles.kite_api_key`. The plaintext is never written to
 * disk or returned to the client.
 *
 * Storage format: v1:<iv>:<tag>:<ct>  (see api/_crypto.ts)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user } = await requireAuth(req);
    const { api_key } = req.body || {};

    if (typeof api_key !== 'string' || api_key.trim().length === 0) {
      return res.status(400).json({ error: 'API key is required' });
    }

    if (!isValidKiteKeyFormat(api_key)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Kite API key format. Keys start with "kite" or "kitepro" and are 10+ characters.',
      });
    }

    let encrypted: string;
    try {
      encrypted = encrypt(api_key.trim());
    } catch (err) {
      if (err instanceof CryptoError) {
        // KITE_KEY_ENCRYPTION_KEY missing or invalid → 500 (operator config)
        console.error('[save-key] crypto error:', err.message);
        return res.status(500).json({ error: 'Server encryption not configured' });
      }
      throw err;
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('user_profiles')
      .update({ kite_api_key: encrypted, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    if (error) {
      console.error('[save-key] supabase error:', error);
      return res.status(500).json({ error: 'Failed to save API key' });
    }

    return res.status(200).json({
      success: true,
      message: 'Kite API key saved. You will be prompted to log in via popup when placing live orders.',
    });
  } catch (err) {
    console.error('[save-key] unexpected error:', err);
    if (err instanceof UnauthorizedError) {
      return res.status(401).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
