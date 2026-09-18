/**
 * /api/paper-trade — MegaBull paper-trading proxy + consolidated routes
 *
 * POST /api/paper-trade          → place a simulated order via MegaBull
 * GET  /api/paper-trade          → list user's paper positions (from our DB)
 * PATCH /api/paper-trade/:id     → update paper position (consolidated from paper-positions/[id])
 * DELETE /api/paper-trade/:id    → delete paper position (consolidated from paper-positions/[id])
 *
 * CONSOLIDATED ROUTES (Hobby Plan ≤12 functions):
 *   - paper-positions/[id].ts → PATCH/DELETE via handleById here
 *   - api/reconcile-orders/index.ts → REMOVED (frontend no longer references)
 *
 * The MegaBull API key is fetched server-side (decrypted from user_profiles).
 * Requests are forwarded to https://api.megabull.in with the api-key header.
 * Successful orders are also recorded in our paper_positions table for tracking.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, UnauthorizedError, getSupabaseAdmin } from '../_auth.js';
import { decrypt } from '../_crypto.js';

const MEGABULL_BASE = 'https://api.megabull.in';

async function getUserMegaBullKey(userId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('user_profiles')
    .select('megabull_api_key')
    .eq('user_id', userId)
    .maybeSingle();
  const encrypted = (data?.megabull_api_key as string | null) ?? null;
  if (!encrypted) return null;
  try {
    return decrypt(encrypted);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// POST — place a paper order via MegaBull
// ---------------------------------------------------------------------------

async function handlePost(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { user } = await requireAuth(req);
  const megabullKey = await getUserMegaBullKey(user.id);
  if (!megabullKey) {
    return void res.status(400).json({ error: 'MegaBull API key not configured. Go to Settings → Connections.' });
  }

  const {
    symbol, name, sector, cap_category,
    entry_price, stop_loss, target1, target2,
    quantity, product, strategy_id, strategy_name,
    instrument_token,
  } = req.body;

  if (!symbol || !entry_price || !stop_loss || !quantity) {
    return void res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Place order on MegaBull
    // MegaBull requires InstrumentToken (numeric), tradingsymbol, and Price.
    // The user's config should provide an instrument_token for each symbol.
    if (!instrument_token) {
      return void res.status(400).json({
        error: 'InstrumentToken is required for paper trading. Set instrument_token in the stock config or use Execute in Kite instead.',
      });
    }

    const resMega = await fetch(`${MEGABULL_BASE}/api/order/buysell`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': megabullKey },
      body: JSON.stringify({
        exchange: 'NSE',
        tradingsymbol: symbol.replace('.NS', ''),
        transaction_type: 'BUY',
        quantity,
        order_type: 'MARKET',
        product: product || 'CNC',
        instrument_token: instrument_token || null,
        price: entry_price || null,
      }),
    });

    if (!resMega.ok) {
      const body = await resMega.json().catch(() => ({}));
      return void res.status(resMega.status >= 400 && resMega.status < 500 ? resMega.status : 502).json({
        error: body?.message || body?.error || 'MegaBull rejected the paper order',
      });
    }
    const megaOrder = await resMega.json();
    const supabase = getSupabaseAdmin();
    const { data: position, error } = await supabase.from('paper_positions').insert({
      user_id: user.id,
      strategy_id: strategy_id || null,
      strategy_name: strategy_name || null,
      symbol,
      name: name || symbol,
      sector: sector || 'Unknown',
      cap_category: cap_category || 'large',
      entry_price,
      stop_loss,
      target1,
      target2: target2 || null,
      quantity,
      risk_amount: (entry_price - stop_loss) * quantity,
      risk_pct: 2,
      charges_estimate: 0,
      status: 'entry_filled',
      entry_filled_at: new Date().toISOString(),
      entry_filled_price: entry_price,
      total_charges: 0,
      notes: megaOrder ? `MegaBull order: ${JSON.stringify(megaOrder).slice(0, 200)}` : null,
    }).select().single();

    if (error) throw error;

    return void res.status(201).json({
      ...position,
      megaBullOrder: megaOrder,
      message: 'Paper trade placed (MegaBull simulated + stored locally)',
    });
  } catch (err: any) {
    console.error('[paper-trade] error:', err);
    return void res.status(500).json({ error: 'Failed to place paper trade', details: err.message });
  }
}

// ---------------------------------------------------------------------------
// GET — list paper positions (from our DB)
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
// PATCH / DELETE — by position ID (consolidated from paper-positions/[id].ts)
// ---------------------------------------------------------------------------

async function handleById(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Extract ID from URL path (e.g., /api/paper-trade/abc-123) since Vercel
  // doesn't populate req.query.id without a [id].ts file.
  const urlPath = (req.url ?? '').split('?')[0];
  const pathId = urlPath.split('/').pop() ?? '';
  const { id } = req.query;
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const positionId =
    typeof id === 'string' && UUID_REGEX.test(id)
      ? id
      : typeof pathId === 'string' && UUID_REGEX.test(pathId)
        ? pathId
        : '';

  if (!positionId) {
    return void res.status(400).json({ error: 'Position ID required' });
  }

  const { user } = await requireAuth(req);
  const supabase = getSupabaseAdmin();

  try {
    if (req.method === 'PATCH') {
      const { status, exit_filled_price, exit_filled_at, notes, tags } = req.body;

      const { data: current, error: fetchError } = await supabase
        .from('paper_positions')
        .select('*')
        .eq('id', positionId)
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
        const exitCharges =
          Math.round(exit_filled_price * current.quantity * 0.0005 * 100) / 100;
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
        .eq('id', positionId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return void res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { error } = await supabase
        .from('paper_positions')
        .delete()
        .eq('id', positionId)
        .eq('user_id', user.id);

      if (error) throw error;
      return void res.status(204).end();
    }

    return void res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('[paper-trade by-id] error:', error);
    if (error instanceof UnauthorizedError) return void res.status(401).json({ error: error.message });
    return void res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  /*
  ────────────────────────────────────────────────────────────
  CONSOLIDATION — HOBBY PLAN OPTIMIZATION (≤12 functions)
  ────────────────────────────────────────────────────────────

  Vercel Hobby tier supports a maximum of 12 Serverless Functions.
  The original 16 routes have been consolidated to 12 using:

  1. paper-positions/[id].ts + paper-positions/index.ts
     → This file via handleById (PATCH/DELETE by ID)
     [Saved 1 function]

  2. executions/index.ts + executions/[id].ts + executions/cashflows.ts
     → Consolidated into executions/index.ts (CRUD via method dispatch)
     [Saved 2 functions]

  3. api/reconcile-orders/index.ts
     → REMOVED (frontend no longer references this endpoint)
     [Saved 1 function]

  Total: 16 → 12 functions (exactly at Hobby plan limit)
  ──────────────────────────────────────────────────────────── */
  try {
    switch (req.method) {
      case 'POST': return await handlePost(req, res);
      case 'GET':  return await handleGet(req, res);
      case 'PATCH': return await handleById(req, res);
      case 'DELETE': return await handleById(req, res);
      default:     return void res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('[paper-trade] unexpected error:', err);
    if (err instanceof UnauthorizedError) return void res.status(401).json({ error: err.message });
    return void res.status(500).json({ error: 'Internal server error' });
  }
}
