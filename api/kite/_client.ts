import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const KITE_API_BASE = 'https://api.kite.trade';
const KITE_LOGIN_URL = 'https://kite.zerodha.com/connect/login';

// Service-role client for trusted backend operations (token verification, profile lookups)
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface KiteCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken?: string;
  userId?: string;
}

export interface AuthContext {
  user: { id: string; email?: string };
  supabase: SupabaseClient;
  credentials: KiteCredentials | null;
}

async function getUserKiteCredentials(userId: string): Promise<KiteCredentials | null> {
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('zerodha_api_key, zerodha_api_secret, zerodha_access_token, zerodha_access_token_expires_at, zerodha_user_id')
    .eq('user_id', userId)
    .single();

  if (!profile?.zerodha_api_key || !profile?.zerodha_api_secret) return null;

  // Check if access token is expired (expires at 6 AM next day)
  const isExpired = profile.zerodha_access_token_expires_at
    ? new Date(profile.zerodha_access_token_expires_at) < new Date()
    : true;

  return {
    apiKey: profile.zerodha_api_key,
    apiSecret: profile.zerodha_api_secret,
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

/**
 * Authenticate a request using a Supabase Bearer token.
 *
 * Throws `Unauthorized` if the token is missing or invalid.
 * Returns the authenticated user, a per-request Supabase client (with the
 * user's JWT so RLS policies apply), and any stored Zerodha credentials.
 *
 * Callers should catch `Unauthorized` and respond with 401.
 */
export async function requireAuth(req: VercelRequest): Promise<AuthContext> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing Authorization header');
  }

  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    throw new UnauthorizedError('Invalid or expired session');
  }

  // Build a per-request Supabase client that forwards the user's JWT.
  // Queries through this client respect RLS as the authenticated user.
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!;
  const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const credentials = await getUserKiteCredentials(user.id);

  return {
    user: { id: user.id, email: user.email },
    supabase: userSupabase,
    credentials,
  };
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export { KITE_API_BASE, KITE_LOGIN_URL, kiteRequest, generateChecksum, getUserKiteCredentials, supabaseAdmin };