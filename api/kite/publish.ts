import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, UnauthorizedError, getSupabaseAdmin } from '../_auth.js';
import { decrypt, CryptoError } from '../_crypto.js';

/**
 * POST /api/kite/publish
 *
 * Returns a short-lived "publish ticket" containing the user's Kite
 * API key in plaintext. The client uses this ticket to initialize the
 * Kite Publisher popup for a single order, and discards it immediately
 * after `placeOrder()` resolves.
 *
 * The ticket is bound to a nonce + the user's ID and expires in 60s.
 * We log the nonce on every call so misuse (replaying a captured ticket)
 * is detectable server-side.
 *
 * Why not just keep the key in localStorage?
 *   - The user might use multiple devices.
 *   - localStorage is XSS-readable.
 *   - The user should be able to remove the key from one place and have
 *     it gone everywhere immediately.
 *
 * The Kite popup itself only needs the key for the duration of a single
 * order; the user re-authenticates with their broker credentials inside
 * the popup every time.
 */
const TICKET_TTL_SECONDS = 60;

function generateNonce(): string {
  // 16 random bytes is enough entropy to make replays unattributable
  // without needing a backing store of issued nonces.
  return globalThis.crypto.randomUUID
    ? globalThis.crypto.randomUUID()
    : require('node:crypto').randomBytes(16).toString('hex');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user } = await requireAuth(req);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('user_profiles')
      .select('kite_api_key')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[publish] supabase error:', error);
      return res.status(500).json({ error: 'Failed to read API key' });
    }

    if (!data?.kite_api_key) {
      return res.status(404).json({
        error: 'Kite API key not configured. Add it in Settings → Profile.',
        code: 'KITE_KEY_NOT_CONFIGURED',
      });
    }

    let apiKey: string;
    try {
      apiKey = decrypt(data.kite_api_key);
    } catch (err) {
      if (err instanceof CryptoError) {
        console.warn('[publish] decrypt failed:', err.message);
        return res.status(500).json({
          error: 'Failed to decrypt API key. The server encryption key may have been rotated — re-save your key in Settings.',
          code: 'KITE_KEY_DECRYPT_FAILED',
        });
      }
      throw err;
    }

    const issuedAt = Date.now();
    const expiresAt = issuedAt + TICKET_TTL_SECONDS * 1000;
    const nonce = generateNonce();

    console.log(`[publish] issued ticket user=${user.id} nonce=${nonce}`);

    return res.status(200).json({
      apiKey,
      nonce,
      issuedAt,
      expiresAt,
      ttlSeconds: TICKET_TTL_SECONDS,
    });
  } catch (err) {
    console.error('[publish] unexpected error:', err);
    if (err instanceof UnauthorizedError) {
      return res.status(401).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
