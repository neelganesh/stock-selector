import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, UnauthorizedError, getSupabaseAdmin } from '../_auth.js';

/**
 * DELETE /api/kite/delete-key
 *
 * Clears the user's encrypted Kite API key. Idempotent — calling it
 * when no key is set is a no-op success.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user } = await requireAuth(req);
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('user_profiles')
      .update({ kite_api_key: null, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    if (error) {
      console.error('[delete-key] supabase error:', error);
      return res.status(500).json({ error: 'Failed to delete API key' });
    }

    return res.status(200).json({ success: true, message: 'Kite API key deleted.' });
  } catch (err) {
    console.error('[delete-key] unexpected error:', err);
    if (err instanceof UnauthorizedError) {
      return res.status(401).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
