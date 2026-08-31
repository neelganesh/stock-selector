import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../kite/client';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { user, supabase: userSupabase } = await requireAuth(req);

  if (req.method === 'GET') {
    try {
      const { data, error } = await userSupabase
        .from('trade_cash_flows')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true });

      if (error) throw error;

      return res.status(200).json(data || []);
    } catch (error: any) {
      console.error('Cashflows GET error:', error);
      return res.status(500).json({ error: 'Failed to fetch cash flows' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}