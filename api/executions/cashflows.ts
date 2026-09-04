import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, UnauthorizedError } from '../kite/_client';

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