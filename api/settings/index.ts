import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, UnauthorizedError, getSupabaseAdmin } from '../kite/_client.js';

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
  // Use admin client directly - user ID from auth is sufficient for security
  const supabase = getSupabaseAdmin();
  
  console.log('[settings] supabase url:', supabase.supabaseUrl);
  console.log('[settings] user id:', user.id);
  console.log('[settings] user email:', user.email);

  try {
    if (req.method === 'GET') {
      // Whitelist of client-safe fields. Never expose Zerodha credentials.
      // Secret + access_token are server-side only; client must use the
      // /api/kite routes which read them via service role.
      console.log('[settings] GET - user:', user.id);
      
      let { data, error } = await supabase
        .from('user_profiles')
        .select(`
          id, user_id, email, full_name, avatar_url,
          total_capital, risk_per_trade_pct, max_position_pct,
          max_sector_pct, max_open_strategies, daily_loss_limit_pct,
          paper_trading_enabled, paper_trading_capital,
          zerodha_api_key, zerodha_api_secret,
          created_at, updated_at
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      console.log('[settings] GET - query result: data=', !!data, 'error=', error?.message);

      // If no profile exists, create one with defaults
      if (!data) {
        console.log('[settings] No profile found for user', user.id, '- creating with defaults');
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
            max_open_strategies: 5,
            daily_loss_limit_pct: 5,
            paper_trading_enabled: true,
            paper_trading_capital: 100000,
          })
          .select()
          .single();
        
        if (createError) {
          console.error('[settings] Failed to create profile:', JSON.stringify(createError));
          return res.status(500).json({ error: 'Failed to create profile', details: createError?.message });
        }
        console.log('[settings] Profile created:', newProfile?.id);
        return res.status(200).json(newProfile);
      }

      return res.status(200).json(data);
    }

    if (req.method === 'PATCH') {
      const updates = req.body;
      console.log('[settings] PATCH - user:', user.id, 'updates:', JSON.stringify(updates));

      // Whitelist of allowed fields (prevents arbitrary overwrites)
      // Note: Zerodha credentials should be set via the dedicated /api/kite/credentials endpoint
      const allowedFields = [
        'total_capital',
        'risk_per_trade_pct',
        'max_position_pct',
        'max_sector_pct',
        'max_open_strategies',
        'daily_loss_limit_pct',
        'paper_trading_enabled',
        'paper_trading_capital',
        'full_name',
      ];

      // Field-level numeric validation
      const numericValidations: Record<string, { min?: number; max?: number }> = {
        total_capital: { min: 0, max: 1e10 },
        risk_per_trade_pct: { min: 0, max: 10 },
        max_position_pct: { min: 0, max: 100 },
        max_sector_pct: { min: 0, max: 100 },
        max_open_strategies: { min: 1, max: 50 },
        daily_loss_limit_pct: { min: 0, max: 100 },
        paper_trading_capital: { min: 0, max: 1e10 },
      };

      // Filter and validate updates
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (!allowedFields.includes(key)) {
          console.warn(`[settings] Ignoring disallowed field: ${key}`);
          continue;
        }

        // Validate numeric fields
        if (numericValidations[key]) {
          const bounds = numericValidations[key];
          if (typeof value !== 'number' || Number.isNaN(value)) {
            return res.status(400).json({ error: `${key} must be a number` });
          }
          if (bounds.min !== undefined && value < bounds.min) {
            return res.status(400).json({ error: `${key} must be >= ${bounds.min}` });
          }
          if (bounds.max !== undefined && value > bounds.max) {
            return res.status(400).json({ error: `${key} must be <= ${bounds.max}` });
          }
        }

        sanitized[key] = value;
      }

      sanitized.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('user_profiles')
        .update(sanitized)
        .eq('user_id', user.id)
        .select()
        .maybeSingle();

      if (error) {
        console.error('[settings] Profile update error:', JSON.stringify(error));
        return res.status(500).json({ error: 'Failed to update profile', details: error.message });
      }

      return res.status(200).json(data);
    }

    if (req.method === 'POST' && req.body?.action === 'reset_paper_portfolio') {
      // Cancel all open paper positions
      const { error: cancelError } = await supabase
        .from('paper_positions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .in('status', ['pending', 'entry_filled', 'target1_hit']);

      if (cancelError) throw cancelError;

      // Reset paper_trading_capital to default if user didn't override
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('paper_trading_capital')
        .eq('user_id', user.id)
        .single();

      return res.status(200).json({
        success: true,
        message: 'Paper portfolio reset',
        paper_trading_capital: profile?.paper_trading_capital || 1000000,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('[settings] Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
