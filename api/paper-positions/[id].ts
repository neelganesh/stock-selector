import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, UnauthorizedError } from '../../kite/_client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid id' });
  }

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

    if (req.method === 'PATCH') {
      const { status, exit_filled_price, exit_filled_at, notes, tags } = req.body;

      // Fetch current position
      const { data: current, error: fetchError } = await userSupabase
        .from('paper_positions')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (fetchError || !current) {
        return res.status(404).json({ error: 'Paper position not found' });
      }

      // Calculate realized PnL if exiting
      let realized_pnl = current.realized_pnl;
      let total_charges = current.total_charges || 0;

      if (status && ['target1_hit', 'target2_hit', 'stop_loss_hit', 'manually_exited'].includes(status) && exit_filled_price) {
        const entryPrice = current.entry_filled_price || current.entry_price;
        const grossPnl = (exit_filled_price - entryPrice) * current.quantity;
        // Simulate exit charges (rough estimate: 0.05% of exit value)
        const exitCharges = Math.round(exit_filled_price * current.quantity * 0.0005 * 100) / 100;
        realized_pnl = Math.round((grossPnl - exitCharges - total_charges) * 100) / 100;
        total_charges = Math.round((total_charges + exitCharges) * 100) / 100;
      }

      const { data, error } = await userSupabase
        .from('paper_positions')
        .update({
          ...(status && { status }),
          ...(exit_filled_price && { exit_filled_price }),
          ...(exit_filled_at && { exit_filled_at }),
          ...(notes !== undefined && { notes }),
          ...(tags !== undefined && { tags }),
          ...(realized_pnl !== undefined && { realized_pnl }),
          ...(total_charges !== undefined && { total_charges }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { error } = await userSupabase
        .from('paper_positions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Paper position PATCH/DELETE error:', error);
    if (error.message === 'Unauthorized') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
