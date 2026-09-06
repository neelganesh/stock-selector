/**
 * /api/paper-positions — paper trading position management
 *
 * GET    /api/paper-positions             → list all positions
 * POST   /api/paper-positions             → create a new position
 * PATCH  /api/paper-positions/:id         → update a position
 * DELETE /api/paper-positions/:id         → delete a position
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, UnauthorizedError, getSupabaseAdmin } from '../_auth.js';

// ---------------------------------------------------------------------------
// GET — list positions
// ---------------------------------------------------------------------------

async function handleGet(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { user } = await requireAuth(req);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('paper_positions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return void res.status(200).json(data || []);
}

// ---------------------------------------------------------------------------
// POST — create position
// ---------------------------------------------------------------------------

async function handlePost(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { user } = await requireAuth(req);
  const supabase = getSupabaseAdmin();

  const {
    strategy_id,
    strategy_name,
    symbol,
    name,
    sector,
    cap_category,
    entry_price,
    stop_loss,
    target1,
    target2,
    quantity,
    risk_amount,
    risk_pct,
    charges_estimate,
    notes,
    tags,
  } = req.body;

  if (!strategy_id || !symbol || !entry_price || !stop_loss || !quantity) {
    return void res.status(400).json({ error: 'Missing required fields' });
  }

  const entryFilledAt = new Date().toISOString();
  const { data: paperPosition, error: paperError } = await supabase
    .from('paper_positions')
    .insert({
      user_id: user.id,
      strategy_id,
      strategy_name,
      symbol,
      name: name || symbol,
      sector: sector || 'Unknown',
      cap_category: cap_category || 'large',
      entry_price,
      stop_loss,
      target1,
      target2: target2 || null,
      quantity,
      risk_amount,
      risk_pct,
      charges_estimate: charges_estimate?.total || charges_estimate || 0,
      status: 'entry_filled',
      entry_filled_at: entryFilledAt,
      entry_filled_price: entry_price,
      total_charges: charges_estimate?.total || charges_estimate || 0,
      notes: notes || null,
      tags: tags || null,
    })
    .select()
    .single();

  if (paperError) throw paperError;

  return void res.status(201).json({
    ...paperPosition,
    simulated: true,
    message: 'Paper trade executed (simulated fill)',
  });
}

// ---------------------------------------------------------------------------
// PATCH / DELETE — by ID
// ---------------------------------------------------------------------------

async function handleById(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { id } = req.query;
  if (typeof id !== 'string') {
    return void res.status(400).json({ error: 'Invalid id' });
  }

  const { user } = await requireAuth(req);
  const supabase = getSupabaseAdmin();

  // PATCH
  if (req.method === 'PATCH') {
    const { status, exit_filled_price, exit_filled_at, notes, tags } = req.body;

    const { data: current, error: fetchError } = await supabase
      .from('paper_positions')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !current) {
      return void res.status(404).json({ error: 'Paper position not found' });
    }

    let realized_pnl = current.realized_pnl;
    let total_charges = current.total_charges || 0;

    if (
      status &&
      ['target1_hit', 'target2_hit', 'stop_loss_hit', 'manually_exited'].includes(status) &&
      exit_filled_price
    ) {
      const entryPrice = current.entry_filled_price || current.entry_price;
      const grossPnl = (exit_filled_price - entryPrice) * current.quantity;
      const exitCharges = Math.round(exit_filled_price * current.quantity * 0.0005 * 100) / 100;
      realized_pnl = Math.round((grossPnl - exitCharges - total_charges) * 100) / 100;
      total_charges = Math.round((total_charges + exitCharges) * 100) / 100;
    }

    const { data, error } = await supabase
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
    return void res.status(200).json(data);
  }

  // DELETE
  if (req.method === 'DELETE') {
    const { error } = await supabase
      .from('paper_positions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    return void res.status(204).end();
  }

  return void res.status(405).json({ error: 'Method not allowed' });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    switch (req.method) {
      case 'GET':    return handleGet(req, res);
      case 'POST':   return handlePost(req, res);
      case 'PATCH':
      case 'DELETE': return handleById(req, res);
      default:
        return void res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('[paper-positions] unexpected error:', err);
    if (err instanceof UnauthorizedError) {
      return void res.status(401).json({ error: err.message });
    }
    return void res.status(500).json({ error: 'Internal server error' });
  }
}
