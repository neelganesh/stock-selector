/**
 * /api/admin/create-user — POST
 *
 * Creates a user directly via Supabase Admin API (service_role key).
 * Bypasses all auth API rate limits. For testing/admin only.
 *
 * CONSOLIDATED: Also handles /api/admin/refresh-universe via POST ?action=refresh-universe
 * (both are admin-only, CRON_SECRET protected, use Admin API).
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY env var.
 * Requires CRON_SECRET or x-admin-token header for security.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

// Simple auth check for the admin endpoint
function isAuthorized(req: VercelRequest): boolean {
  const token = req.headers['x-admin-token'] || req.query.token;
  const cronSecret = process.env.CRON_SECRET;
  return token === cronSecret;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized. Provide x-admin-token header matching CRON_SECRET.' });
  }

  // Handle refresh-universe action (consolidated from /api/admin/refresh-universe)
  // Note: universe stock counts are maintained separately via scheduled cron job.
  // This endpoint returns a minimal response for backward compatibility.
  if (req.body?.action === 'refresh-universe') {
    return void res.status(200).json({
      ok: true,
      total: 0,
      large: 0,
      mid: 0,
      small: 0,
      durationMs: 0,
      message: 'Universe refresh runs via scheduled cron job.',
    });
  }

  // Handle create-user action (default)

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { username, password, email, full_name } = req.body as Record<string, string>;

  // Validate input
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  // Username validation: alphanumeric, hyphens, underscores only
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return res.status(400).json({ error: 'Username can only contain letters, numbers, hyphens, and underscores' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const virtualEmail = email || `${username}@stock-selector.local`;

  try {
    // Create user via Admin API (no rate limits)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: virtualEmail,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        full_name: full_name || null,
      },
    });

    if (error) {
      // If user exists, return existing user info
      if (error.message?.includes('already registered')) {
        return res.status(200).json({
          success: true,
          message: 'User already exists',
          user: { email: virtualEmail, username },
        });
      }
      console.error('[create-user] error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log(`[create-user] Created user: ${username} (${virtualEmail})`);
    return res.status(200).json({
      success: true,
      message: 'User created successfully',
      user: { id: data.user?.id, email: virtualEmail, username },
    });
  } catch (err: any) {
    console.error('[create-user] unexpected error:', err);
    return res.status(500).json({ error: err.message });
  }
}
