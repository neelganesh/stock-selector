import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const KITE_API_BASE = 'https://api.kite.trade';
const KITE_LOGIN_URL = 'https://kite.zerodha.com/connect/login';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface KiteCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken?: string;
  userId?: string;
}

async function getUserKiteCredentials(userId: string): Promise<KiteCredentials | null> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('zerodha_api_key, zerodha_access_token, zerodha_access_token_expires_at, zerodha_user_id')
    .eq('user_id', userId)
    .single();

  if (!profile?.zerodha_api_key) return null;

  // Check if access token is expired (expires at 6 AM next day)
  const isExpired = profile.zerodha_access_token_expires_at 
    ? new Date(profile.zerodha_access_token_expires_at) < new Date()
    : true;

  return {
    apiKey: profile.zerodha_api_key,
    apiSecret: process.env.KITE_API_SECRET!, // Stored in Vercel env, not user-specific
    accessToken: isExpired ? undefined : profile.zerodha_access_token,
    userId: profile.zerodha_user_id || undefined,
  };
}

function generateChecksum(apiKey: string, requestToken: string, apiSecret: string): string {
  return crypto
    .createHash('sha256')
    .update(apiKey + requestToken + apiSecret)
    .digest('hex');
}

async function kiteRequest(
  credentials: KiteCredentials,
  method: string,
  endpoint: string,
  body?: Record<string, string>
): Promise<any> {
  const url = `${KITE_API_BASE}${endpoint}`;
  const headers: Record<string, string> = {
    'X-Kite-Version': '3',
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (credentials.accessToken) {
    headers['Authorization'] = `token ${credentials.apiKey}:${credentials.accessToken}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? new URLSearchParams(body).toString() : undefined,
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || `Kite API error: ${response.status}`);
  }

  return data;
}

export async function requireAuth(req: VercelRequest): Promise<{ userId: string; credentials: KiteCredentials } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return null;
  }

  const credentials = await getUserKiteCredentials(user.id);
  if (!credentials) {
    return null;
  }

  return { userId: user.id, credentials };
}

export { KITE_API_BASE, KITE_LOGIN_URL, kiteRequest, generateChecksum, getUserKiteCredentials };