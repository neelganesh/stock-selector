import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, UnauthorizedError, getSupabaseAdmin } from '../_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user } = await requireAuth(req);
    const { api_key } = req.body || {};

    if (!api_key || typeof api_key !== 'string') {
      return res.status(400).json({ error: 'API key is required' });
    }

    // Test connection by calling Kite's holdings endpoint with the API key
    // Publisher mode uses a popup flow, so we just validate the key format
    if (!api_key.startsWith('kitepro') && !api_key.startsWith('kite') && api_key.length < 10) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid API key format. Kite API keys typically start with "kite" or "kitepro".' 
      });
    }

    // Store the API key in user profile
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('user_profiles')
      .update({ kite_api_key: api_key, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    if (error) {
      console.error('Error saving Kite API key:', error);
      return res.status(500).json({ error: 'Failed to save API key' });
    }

    return res.status(200).json({ 
      success: true,
      message: 'Kite API key saved successfully. You will be prompted to login via popup when placing orders.' 
    });
  } catch (err) {
    console.error('Error in test-connection:', err);
    if (err instanceof UnauthorizedError) {
      return res.status(401).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
