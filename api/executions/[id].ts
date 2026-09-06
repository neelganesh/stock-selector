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
  const supabase = getSupabaseAdmin();
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Execution ID required' });
  }

  try {
    if (req.method === 'GET') {
      // Get single execution with cash flows
      const [execution, cashFlows] = await Promise.all([
        supabase
          .from('strategy_executions')
          .select('*')
          .eq('id', id)
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('trade_cash_flows')
          .select('*')
          .eq('execution_id', id)
          .order('created_at', { ascending: true }),
      ]);

      if (execution.error) throw execution.error;
      if (cashFlows.error) throw cashFlows.error;

      return res.status(200).json({ ...execution.data, cashFlows: cashFlows.data });
    }

    if (req.method === 'PATCH') {
      // Update execution status
      const updates = req.body;

      const { data, error } = await supabase
        .from('strategy_executions')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      // If status changed to filled/exited, add cash flow
      // Note: Schema column is 'type' (NOT 'flow_type')
      if (updates.status === 'entry_filled' && updates.entry_filled_price) {
        await supabase.from('trade_cash_flows').insert({
          execution_id: id,
          user_id: user.id,
          type: 'entry', // FIX: was 'flow_type' - column name is 'type'
          amount: -(updates.quantity * updates.entry_filled_price),
          date: new Date().toISOString(),
          description: `Entry filled: ${updates.quantity} ${updates.symbol} @ ${updates.entry_filled_price}`,
        });
      }

      if (['target1_hit', 'target2_hit', 'stop_loss_hit', 'manually_exited'].includes(updates.status) && updates.exit_filled_price) {
        const pnl = (updates.exit_filled_price - updates.entry_filled_price) * updates.quantity;
        await supabase.from('trade_cash_flows').insert({
          execution_id: id,
          user_id: user.id,
          type: 'exit', // FIX: was 'flow_type'
          amount: updates.quantity * updates.exit_filled_price,
          date: new Date().toISOString(),
          description: `Exit: ${updates.quantity} ${updates.symbol} @ ${updates.exit_filled_price}`,
        });
        await supabase.from('trade_cash_flows').insert({
          execution_id: id,
          user_id: user.id,
          type: 'charge', // FIX: was 'flow_type'
          amount: -(updates.total_charges || 0),
          date: new Date().toISOString(),
          description: `Charges for ${updates.symbol}`,
        });
      }

      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      // Cancel execution
      const { error } = await supabase
        .from('strategy_executions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Execution PATCH/DELETE error:', error);
    return res.status(500).json({ error: 'Failed to update execution' });
  }
}