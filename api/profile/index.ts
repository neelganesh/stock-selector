import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, UnauthorizedError, getSupabaseAdmin } from '../_auth.js';

/**
 * /api/profile — GET (read) / PATCH (update own profile) / DELETE (delete account)
 *
 * GET    — returns the user profile
 * PATCH  — updates full_name and paper_trading fields
 * DELETE — deletes the auth user + cascades to user_profiles via FK
 */

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const PAPER_FIELDS = [
  'paper_trading_enabled',
  'paper_trading_capital',
] as const;

const IDENTITY_FIELDS = ['full_name'] as const;

type PaperField = (typeof PAPER_FIELDS)[number];
type IdentityField = (typeof IDENTITY_FIELDS)[number];

const numericBounds: Partial<Record<PaperField, { min: number; max: number }>> = {
  paper_trading_capital: { min: 0, max: 1e10 },
};

function sanitizePatch(body: Record<string, unknown>): Record<string, unknown> {
  const allowed: Array<IdentityField | PaperField> = [
    ...IDENTITY_FIELDS,
    ...PAPER_FIELDS,
  ];
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      const val = body[key];
      if (key === 'paper_trading_capital') {
        const b = numericBounds.paper_trading_capital!;
        const n = Number(val);
        if (!Number.isFinite(n) || n < b.min || n > b.max) {
          throw new Error(`${key} must be a number between ${b.min} and ${b.max}`);
        }
        out[key] = n;
      } else {
        out[key] = val;
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* GET                                                                  */
/* ------------------------------------------------------------------ */

async function handleGet(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { user } = await requireAuth(req);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('user_profiles')
    .select(
      'id, user_id, email, full_name, paper_trading_enabled, paper_trading_capital, created_at, updated_at',
    )
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[profile GET] error:', error);
    return res.status(500).json({ error: 'Failed to load profile' });
  }
  if (!data) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  return res.status(200).json(data);
}

/* ------------------------------------------------------------------ */
/* PATCH                                                                */
/* ------------------------------------------------------------------ */

async function handlePatch(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { user } = await requireAuth(req);
  const body = req.body as Record<string, unknown>;

  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  let sanitized: Record<string, unknown>;
  try {
    sanitized = sanitizePatch(body);
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
  if (Object.keys(sanitized).length === 0) {
    return res.status(400).json({ error: 'No allowed fields to update' });
  }
  sanitized.updated_at = new Date().toISOString();

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('user_profiles')
    .update(sanitized)
    .eq('user_id', user.id)
    .select(
      'id, user_id, email, full_name, paper_trading_enabled, paper_trading_capital, created_at, updated_at',
    )
    .maybeSingle();

  if (error) {
    console.error('[profile PATCH] error:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }

  return res.status(200).json(data);
}

/* ------------------------------------------------------------------ */
/* DELETE — delete account                                             */
/* ------------------------------------------------------------------ */

async function handleDelete(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { user } = await requireAuth(req);
  const supabase = getSupabaseAdmin();

  const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(user.id);

  if (deleteAuthError) {
    console.error('[profile DELETE] auth delete error:', deleteAuthError);
    // 404 = already deleted — treat as success
    if (deleteAuthError.message.includes('not found')) {
      return res.status(200).json({ success: true, message: 'Account already deleted.' });
    }
    return res.status(500).json({ error: 'Failed to delete account. Please contact support.' });
  }

  return res.status(200).json({ success: true, message: 'Account deleted.' });
}

/* ------------------------------------------------------------------ */
/* Handler                                                              */
/* ------------------------------------------------------------------ */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    switch (req.method) {
      case 'GET':    return handleGet(req, res);
      case 'PATCH':  return handlePatch(req, res);
      case 'DELETE': return handleDelete(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('[profile] unexpected error:', err);
    if (err instanceof UnauthorizedError) {
      return res.status(401).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
