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
        .from('strategy_executions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return res.status(200).json(data || []);
    } catch (error: any) {
      console.error('Executions GET error:', error);
      return res.status(500).json({ error: 'Failed to fetch executions' });
    }
  }

  if (req.method === 'POST') {
    try {
      const {
        strategy_id,
        strategy_name,
        symbol,
        exchange,
        entry_price,
        stop_loss,
        target1,
        target2,
        quantity,
        product,
        risk_amount,
        risk_pct,
        capital_allocated,
        charges_estimate,
      } = req.body;

      // Validate required fields
      if (!strategy_id || !symbol || !entry_price || !stop_loss || !quantity) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Create execution record
      const { data: execution, error: execError } = await userSupabase
        .from('strategy_executions')
        .insert({
          user_id: user.id,
          strategy_id,
          strategy_name,
          symbol,
          exchange: exchange || 'NSE',
          entry_price,
          stop_loss,
          target1,
          target2,
          quantity,
          product: product || 'CNC',
          risk_amount,
          risk_pct,
          capital_allocated: capital_allocated || entry_price * quantity,
          charges_estimate,
          status: 'pending_entry',
        })
        .select()
        .single();

      if (execError) throw execError;

      // Create initial cash flow record (entry order placed)
      await userSupabase.from('trade_cash_flows').insert({
        execution_id: execution.id,
        user_id: user.id,
        flow_type: 'entry_order',
        amount: -(capital_allocated || entry_price * quantity) - (charges_estimate?.total || 0),
        description: `Entry order placed for ${quantity} ${symbol} @ ${entry_price}`,
        metadata: { quantity, price: entry_price, charges: charges_estimate },
      });

      return res.status(201).json(execution);
    } catch (error: any) {
      console.error('Executions POST error:', error);
      return res.status(500).json({ error: 'Failed to create execution' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}