import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const KITE_API_BASE = 'https://api.kite.trade';
const KITE_LOGIN_URL = 'https://kite.zerodha.com/connect/login';

/**
 * Environment variable access for API routes.
 * 
 * IMPORTANT: In API routes (Next.js/Vercel), ONLY use non-VITE_ prefixed env vars.
 * VITE_* vars are only available in the browser bundle via import.meta.env.
 * For server-side code, use process.env directly.
 */

// Get required env var with helpful error message
function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

// Get optional env var, returns undefined if not set
function getEnvOptional(key: string): string | undefined {
  return process.env[key];
}

// Secret-key (formerly service_role) client for trusted backend operations
// (token verification, profile lookups). The Secret key is server-only —
// never expose it to the browser bundle.
const supabaseUrl = getEnvOptional('SUPABASE_URL') || getEnvOptional('VITE_SUPABASE_URL');
// Use SERVICE_ROLE_KEY if available (legacy name), fall back to SECRET_KEY (newer naming)
const supabaseSecretKey = getEnvOptional('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_SECRET_KEY');

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL not configured - add SUPABASE_URL or VITE_SUPABASE_URL to Vercel env');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  }
});

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
    console.log('[requireAuth] Missing or invalid Authorization header:', authHeader);
    throw new UnauthorizedError('Missing Authorization header');
  }

  const token = authHeader.slice(7);
  console.log('[requireAuth] Token present, length:', token.length, 'prefix:', token.substring(0, 20) + '...');
  
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  console.log('[requireAuth] getUser result - user:', user?.id, 'email:', user?.email, 'error:', error);

  if (error || !user) {
    throw new UnauthorizedError('Invalid or expired session');
  }

  // Build a per-request Supabase client that forwards the user's JWT.
  // Queries through this client respect RLS as the authenticated user.
  const supabaseUrl = getEnvOptional('SUPABASE_URL') || getEnvOptional('VITE_SUPABASE_URL') || (() => { throw new Error('SUPABASE_URL not configured'); })();
  const supabaseAnonKey = getEnvOptional('SUPABASE_ANON_KEY') || getEnvOptional('VITE_SUPABASE_ANON_KEY') || (() => { throw new Error('SUPABASE_ANON_KEY not configured'); })();
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