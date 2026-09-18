/**
 * /api/settings — GET (read) / PATCH (update)
 *
 * This was previously a monolithic /api/settings handler that handled
 * GET/PATCH/POST/RESET. It is now split:
 *   - GET /api/settings → read settings (from user_profiles)
 *   - PATCH /api/settings → update settings
 *   - POST /api/settings?action=reset_paper_portfolio → reset paper portfolio
 *   - /api/profile → profile CRUD (read/update/password change/delete)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, UnauthorizedError, getSupabaseAdmin } from '../_auth.js';

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

async function handleGet(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { user } = await requireAuth(req);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('user_profiles')
    .select(
      'id, user_id, email, full_name, avatar_url, total_capital, risk_per_trade_pct, max_position_pct, max_sector_pct, max_open_strategies, daily_loss_limit_pct, paper_trading_enabled, paper_trading_capital, kite_api_key, created_at, updated_at',
    )
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[settings GET] error:', error);
    return void res.status(500).json({ error: 'Failed to load settings' });
  }

  // If no profile exists, create one with defaults
  if (!data) {
    const { data: newProfile, error: createError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: user.id,
        email: user.email || '',
        full_name: user.email?.split('@')[0] || 'User',
        total_capital: 100000,
        risk_per_trade_pct: 2,
        max_position_pct: 10,
        max_sector_pct: 25,
        max_open_strategies: 10,
        daily_loss_limit_pct: 3,
        paper_trading_enabled: false,
        paper_trading_capital: 100000,
      })
      .select()
      .single();

    if (createError) {
      console.error('[settings GET] failed to create profile:', createError);
      return void res.status(500).json({ error: 'Failed to create profile', details: createError.message });
    }
    return void res.status(200).json(newProfile);
  }

  return void res.status(200).json(data);
}

// ---------------------------------------------------------------------------
// PATCH
// ---------------------------------------------------------------------------

const ALLOWED_FIELDS = [
  'total_capital',
  'risk_per_trade_pct',
  'max_position_pct',
  'max_sector_pct',
  'max_open_strategies',
  'daily_loss_limit_pct',
  'paper_trading_enabled',
  'paper_trading_capital',
  'full_name',
  'zerodha_api_key',
];

const NUMERIC_VALIDATIONS: Record<string, { min?: number; max?: number }> = {
  total_capital: { min: 0, max: 1e10 },
  risk_per_trade_pct: { min: 0, max: 10 },
  max_position_pct: { min: 0, max: 100 },
  max_sector_pct: { min: 0, max: 100 },
  max_open_strategies: { min: 1, max: 50 },
  daily_loss_limit_pct: { min: 0, max: 100 },
  paper_trading_capital: { min: 0, max: 1e10 },
};

async function handlePatch(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { user } = await requireAuth(req);
  const updates = req.body as Record<string, unknown>;

  if (!updates || typeof updates !== 'object') {
    return void res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  // Filter and validate updates
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (!ALLOWED_FIELDS.includes(key)) {
      continue;
    }
    if (NUMERIC_VALIDATIONS[key]) {
      const bounds = NUMERIC_VALIDATIONS[key];
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return void res.status(400).json({ error: `${key} must be a number` });
      }
      if (bounds.min !== undefined && value < bounds.min) {
        return void res.status(400).json({ error: `${key} must be >= ${bounds.min}` });
      }
      if (bounds.max !== undefined && value > bounds.max) {
        return void res.status(400).json({ error: `${key} must be <= ${bounds.max}` });
      }
    }
    sanitized[key] = value;
  }

  if (Object.keys(sanitized).length === 0) {
    return void res.status(400).json({ error: 'No allowed fields to update' });
  }

  sanitized.updated_at = new Date().toISOString();

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('user_profiles')
    .update(sanitized)
    .eq('user_id', user.id)
    .select()
    .maybeSingle();

  if (error) {
    console.error('[settings PATCH] error:', error);
    return void res.status(500).json({ error: 'Failed to update settings', details: error.message });
  }

  return void res.status(200).json(data);
}

// ---------------------------------------------------------------------------
// POST — reset paper portfolio
// ---------------------------------------------------------------------------

async function handlePost(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { user } = await requireAuth(req);
  const body = req.body as Record<string, unknown> | undefined;

  if (body?.action === 'reset_paper_portfolio') {
    const supabase = getSupabaseAdmin();

    const { error: cancelError } = await supabase
      .from('paper_positions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .in('status', ['pending', 'entry_filled', 'target1_hit']);

    if (cancelError) throw cancelError;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('paper_trading_capital')
      .eq('user_id', user.id)
      .single();

    return void res.status(200).json({
      success: true,
      message: 'Paper portfolio reset',
      paper_trading_capital: profile?.paper_trading_capital || 100000,
    });
  }

  return void res.status(400).json({ error: 'Unknown action' });
}



// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    switch (req.method) {
      case 'GET':    return await handleGet(req, res);
      case 'PATCH':  return await handlePatch(req, res);
      case 'POST':   return await handlePost(req, res);
      default:
        return void res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('[settings] Unexpected error:', error);
    if (error instanceof UnauthorizedError) {
      return void res.status(401).json({ error: error.message });
    }
    return void res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
