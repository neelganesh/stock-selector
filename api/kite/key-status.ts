import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, UnauthorizedError, getSupabaseAdmin } from '../_auth.js';
import { decrypt, CryptoError } from '../_crypto.js';

/**
 * GET /api/kite/key-status
 *
 * Returns whether the user has a saved Kite API key, and whether it
 * decrypts cleanly with the current KITE_KEY_ENCRYPTION_KEY. The
 * plaintext key is NEVER returned.
 *
 * Used by the ZerodhaStatusButton in the header to show the connection
 * state without round-tripping the key to the browser.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user } = await requireAuth(req);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('user_profiles')
      .select('kite_api_key, updated_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[key-status] supabase error:', error);
      return res.status(500).json({ error: 'Failed to read key status' });
    }

    if (!data?.kite_api_key) {
      return res.status(200).json({ configured: false });
    }

    // We do not return the key — just confirm we can decrypt it.
    try {
      decrypt(data.kite_api_key);
    } catch (err) {
      if (err instanceof CryptoError) {
        console.warn('[key-status] decrypt failed (key rotated?):', err.message);
        return res.status(200).json({
          configured: true,
          working: false,
          updatedAt: data.updated_at,
        });
      }
      throw err;
    }

    return res.status(200).json({
      configured: true,
      working: true,
      updatedAt: data.updated_at,
    });
  } catch (err) {
    console.error('[key-status] unexpected error:', err);
    if (err instanceof UnauthorizedError) {
      return res.status(401).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
