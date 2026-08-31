import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, kiteRequest, KITE_LOGIN_URL, generateChecksum } from './client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireAuth(req);
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { credentials } = auth;
    
    // If no access token, return login URL
    if (!credentials.accessToken) {
      const loginUrl = `${KITE_LOGIN_URL}?v=3&api_key=${credentials.apiKey}`;
      return res.status(200).json({ 
        authenticated: false, 
        loginUrl,
        message: 'Zerodha login required' 
      });
    }

    // Get user profile to verify token works
    const profile = await kiteRequest(credentials, 'GET', '/user/profile');
    
    return res.status(200).json({ 
      authenticated: true, 
      profile: profile.data 
    });
  } catch (error: any) {
    // If token expired, return login URL
    if (error.message?.includes('TokenException') || error.message?.includes('expired')) {
      const loginUrl = `${KITE_LOGIN_URL}?v=3&api_key=${auth.credentials.apiKey}`;
      return res.status(200).json({ 
        authenticated: false, 
        loginUrl,
        message: 'Session expired, please login again' 
      });
    }
    return res.status(500).json({ error: error.message });
  }
}