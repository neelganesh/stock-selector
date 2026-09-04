import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, UnauthorizedError } from '../kite/_client.js';

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

  const { user, supabase: userSupabase } = auth;

    if (req.method === 'GET') {
      const { data, error } = await userSupabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'PATCH') {
      const updates = req.body;

      // Whitelist of allowed fields (prevents arbitrary overwrites)
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
        'zerodha_api_key',
        'zerodha_api_secret',
      ];

      const sanitized: Record<string, any> = {};
      for (const key of allowedFields) {
        if (key in updates) {
          sanitized[key] = updates[key];
        }
      }
      sanitized.updated_at = new Date().toISOString();

      const { data, error } = await userSupabase
        .from('user_profiles')
        .update(sanitized)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'POST' && req.body?.action === 'reset_paper_portfolio') {
      // Cancel all open paper positions
      const { error: cancelError } = await userSupabase
        .from('paper_positions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .in('status', ['pending', 'entry_filled', 'target1_hit']);

      if (cancelError) throw cancelError;

      // Reset paper_trading_capital to default if user didn't override
      const { data: profile } = await userSupabase
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
    console.error('Settings API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
