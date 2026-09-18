import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, UnauthorizedError, getSupabaseAdmin } from '../_auth.js';

// ---------------------------------------------------------------------------
// GET — list all executions for user
// ---------------------------------------------------------------------------

async function handleList(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { user } = await requireAuth(req);
  const supabase = getSupabaseAdmin();

  try {
    const { data, error } = await supabase
      .from('strategy_executions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return void res.status(200).json(data || []);
  } catch (error: any) {
    console.error('Executions GET error:', error);
    return void res.status(500).json({ error: 'Failed to fetch executions' });
  }
}

// ---------------------------------------------------------------------------
// GET /:id — single execution with cash flows
// ---------------------------------------------------------------------------

async function handleGetById(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { user } = await requireAuth(req);
  const supabase = getSupabaseAdmin();
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return void res.status(400).json({ error: 'Execution ID required' });
  }

  try {
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

    return void res.status(200).json({ ...execution.data, cashFlows: cashFlows.data });
  } catch (error: any) {
    console.error('Executions GET by ID error:', error);
    return void res.status(500).json({ error: 'Failed to fetch execution' });
  }
}

// ---------------------------------------------------------------------------
// POST — create execution + initial cash flow
// ---------------------------------------------------------------------------

async function handlePost(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { user } = await requireAuth(req);
  const supabase = getSupabaseAdmin();

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

    if (!strategy_id || !symbol || !entry_price || !stop_loss || !quantity) {
      return void res.status(400).json({ error: 'Missing required fields' });
    }

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

    const capitalAllocated = entry_price * quantity;
    await supabase.from('trade_cash_flows').insert({
      execution_id: execution.id,
      user_id: user.id,
      type: 'entry',
      amount: -(capitalAllocated) - (charges_estimate || 0),
      date: new Date().toISOString(),
      description: `Entry order placed for ${quantity} ${symbol} @ ${entry_price}`,
    });

    return void res.status(201).json(execution);
  } catch (error: any) {
    console.error('Executions POST error:', error);
    return void res.status(500).json({ error: 'Failed to create execution', details: error.message });
  }
}

// ---------------------------------------------------------------------------
// PATCH /:id — update execution, auto-create cash flows on status change
// ---------------------------------------------------------------------------

async function handlePatchById(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { user } = await requireAuth(req);
  const supabase = getSupabaseAdmin();
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return void res.status(400).json({ error: 'Execution ID required' });
  }

  try {
    const updates = req.body;

    const { data, error } = await supabase
      .from('strategy_executions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    if (updates.status === 'entry_filled' && updates.entry_filled_price) {
      await supabase.from('trade_cash_flows').insert({
        execution_id: id,
        user_id: user.id,
        type: 'entry',
        amount: -(updates.quantity * updates.entry_filled_price),
        date: new Date().toISOString(),
        description: `Entry filled: ${updates.quantity} ${updates.symbol} @ ${updates.entry_filled_price}`,
      });
    }

    if (['target1_hit', 'target2_hit', 'stop_loss_hit', 'manually_exited'].includes(updates.status) && updates.exit_filled_price) {
      await supabase.from('trade_cash_flows').insert({
        execution_id: id,
        user_id: user.id,
        type: 'exit',
        amount: updates.quantity * updates.exit_filled_price,
        date: new Date().toISOString(),
        description: `Exit: ${updates.quantity} ${updates.symbol} @ ${updates.exit_filled_price}`,
      });
      await supabase.from('trade_cash_flows').insert({
        execution_id: id,
        user_id: user.id,
        type: 'charge',
        amount: -(updates.total_charges || 0),
        date: new Date().toISOString(),
        description: `Charges for ${updates.symbol}`,
      });
    }

    return void res.status(200).json(data);
  } catch (error: any) {
    console.error('Executions PATCH error:', error);
    return void res.status(500).json({ error: 'Failed to update execution' });
  }
}

// ---------------------------------------------------------------------------
// DELETE /:id — cancel execution
// ---------------------------------------------------------------------------

async function handleDeleteById(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { user } = await requireAuth(req);
  const supabase = getSupabaseAdmin();
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return void res.status(400).json({ error: 'Execution ID required' });
  }

  try {
    const { error } = await supabase
      .from('strategy_executions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    return void res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Executions DELETE error:', error);
    return void res.status(500).json({ error: 'Failed to cancel execution' });
  }
}

// ---------------------------------------------------------------------------
// GET /cashflows — list all cash flows for user
// ---------------------------------------------------------------------------

async function handleCashflows(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { user } = await requireAuth(req);
  const supabase = getSupabaseAdmin();

  try {
    const { data, error } = await supabase
      .from('trade_cash_flows')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true });

    if (error) throw error;
    return void res.status(200).json(data || []);
  } catch (error: any) {
    console.error('Cashflows GET error:', error);
    return void res.status(500).json({ error: 'Failed to fetch cash flows' });
  }
}

// ---------------------------------------------------------------------------
// Handler — method dispatch with sub-routing via query params
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { id } = req.query;
    const path = req.url || '';

    // GET /api/executions/cashflows → cash flows
    if (!id && path.includes('cashflows')) {
      if (req.method === 'GET') return await handleCashflows(req, res);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // GET /api/executions/:id → single execution with cash flows
    if (id && typeof id === 'string' && req.method === 'GET') {
      return await handleGetById(req, res);
    }

    // PATCH /api/executions/:id → update execution
    if (id && typeof id === 'string' && req.method === 'PATCH') {
      return await handlePatchById(req, res);
    }

    // DELETE /api/executions/:id → cancel execution
    if (id && typeof id === 'string' && req.method === 'DELETE') {
      return await handleDeleteById(req, res);
    }

    // GET /api/executions → list all
    if (req.method === 'GET') {
      return await handleList(req, res);
    }

    // POST /api/executions → create
    if (req.method === 'POST') {
      return await handlePost(req, res);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[executions] unexpected error:', err);
    if (err instanceof UnauthorizedError) return res.status(401).json({ error: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
