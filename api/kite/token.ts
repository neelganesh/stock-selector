import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { kiteRequest, generateChecksum, getUserKiteCredentials } from './client';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid auth token' });
  }

  const { requestToken } = req.body;
  if (!requestToken) {
    return res.status(400).json({ error: 'requestToken is required' });
  }

  try {
    const credentials = await getUserKiteCredentials(user.id);
    if (!credentials) {
      return res.status(400).json({ error: 'Zerodha API key not configured' });
    }

    const checksum = generateChecksum(credentials.apiKey, requestToken, credentials.apiSecret);
    
    const response = await kiteRequest(credentials, 'POST', '/session/token', {
      api_key: credentials.apiKey,
      request_token: requestToken,
      checksum,
    });

    const { access_token, user_id, login_time } = response.data;
    
    // Calculate expiry (6 AM next day)
    const expiresAt = new Date();
    expiresAt.setHours(6, 0, 0, 0);
    if (expiresAt <= new Date()) {
      expiresAt.setDate(expiresAt.getDate() + 1);
    }

    // Update user profile with access token
    await supabase
      .from('user_profiles')
      .update({
        zerodha_access_token: access_token,
        zerodha_access_token_expires_at: expiresAt.toISOString(),
        zerodha_user_id: user_id,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    return res.status(200).json({ 
      success: true, 
      userId: user_id,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}