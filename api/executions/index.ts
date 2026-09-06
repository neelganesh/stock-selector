import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, UnauthorizedError, getSupabaseAdmin } from '../_auth.js';

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
  const supabase = getSupabaseAdmin();

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
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
        name,
        sector,
        cap_category,
        exchange,
        entry_price,
        stop_loss,
        target1,
        target2,
        quantity,
        product,
        risk_amount,
        risk_pct,
        charges_estimate,
        is_paper_trade = false,
      } = req.body;

      // Validate required fields
      if (!strategy_id || !symbol || !entry_price || !stop_loss || !quantity) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Create execution record. Schema uses 'pending' (not 'pending_entry'),
      // no 'capital_allocated' column (derived from entry_price * quantity),
      // and includes name/sector/cap_category for display.
      const { data: execution, error: execError } = await supabase
        .from('strategy_executions')
        .insert({
          user_id: user.id,
          strategy_id,
          strategy_name,
          symbol,
          name: name || symbol,
          sector: sector || null,
          cap_category: cap_category || 'large',
          exchange: exchange || 'NSE',
          entry_price,
          stop_loss,
          target1,
          target2: target2 || null,
          quantity,
          product: product || 'CNC',
          risk_amount: risk_amount || 0,
          risk_pct: risk_pct || 0,
          charges_estimate: charges_estimate || 0,
          status: 'pending',
          is_paper_trade,
        })
        .select()
        .single();

      if (execError) throw execError;

      // Create initial cash flow record. Schema column is `type` (not `flow_type`)
      // and 'type' enum values are: 'entry' | 'exit' | 'charge' | 'dividend'.
      const capitalAllocated = entry_price * quantity;
      await supabase.from('trade_cash_flows').insert({
        execution_id: execution.id,
        user_id: user.id,
        type: 'entry',
        amount: -(capitalAllocated) - (charges_estimate || 0),
        date: new Date().toISOString(),
        description: `Entry order placed for ${quantity} ${symbol} @ ${entry_price}`,
      });

      return res.status(201).json(execution);
    } catch (error: any) {
      console.error('Executions POST error:', error);
      return res.status(500).json({ error: 'Failed to create execution', details: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}