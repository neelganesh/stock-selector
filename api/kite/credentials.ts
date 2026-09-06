/**
 * Dedicated endpoint for setting Zerodha API credentials.
 * 
 * This is separate from /api/settings because:
 * 1. Zerodha credentials require special handling (no numeric validation)
 * 2. Credentials should only be set through this dedicated flow
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, UnauthorizedError, getSupabaseAdmin } from './_client.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    throw err;
  }

  const { user } = auth;
  const supabase = getSupabaseAdmin();

  try {
    if (req.method === 'PUT') {
      const { api_key, api_secret } = req.body;

      // Validate inputs
      if (!api_key || typeof api_key !== 'string') {
        return res.status(400).json({ error: 'api_key is required' });
      }
      if (!api_secret || typeof api_secret !== 'string') {
        return res.status(400).json({ error: 'api_secret is required' });
      }

      const apiKey = api_key.trim();
      const apiSecret = api_secret.trim();

      // Basic length validation (Zerodha API keys are 16 chars)
      if (apiKey.length < 10) {
        return res.status(400).json({ error: 'Invalid API key format' });
      }
      if (apiSecret.length < 10) {
        return res.status(400).json({ error: 'Invalid API secret format' });
      }

      // Update the user's profile with Zerodha credentials
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          zerodha_api_key: apiKey,
          zerodha_api_secret: apiSecret,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select('zerodha_api_key')
        .maybeSingle();

      if (error) {
        console.error('[credentials] Failed to save Zerodha credentials:', JSON.stringify(error));
        return res.status(500).json({ error: 'Failed to save credentials', details: error.message });
      }

      console.log('[credentials] Saved Zerodha API key for user:', user.id);
      return res.status(200).json({ 
        success: true, 
        message: 'Credentials saved successfully',
        has_api_key: !!data?.zerodha_api_key 
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('[credentials] Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
