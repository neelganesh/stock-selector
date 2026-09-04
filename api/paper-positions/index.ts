import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, UnauthorizedError } from '../kite/_client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
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

      const { data, error } = await userSupabase
        .from('paper_positions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return res.status(200).json(data || []);
    } catch (error: any) {
      console.error('Paper positions GET error:', error);
      return res.status(500).json({ error: 'Failed to fetch paper positions' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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

    // Validate required fields
    if (!strategy_id || !symbol || !entry_price || !stop_loss || !quantity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Simulate immediate fill for paper trading
    const entryFilledAt = new Date().toISOString();

    // Create paper position record
    const { data: paperPosition, error: paperError } = await userSupabase
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

    return res.status(201).json({
      ...paperPosition,
      simulated: true,
      message: 'Paper trade executed (simulated fill)',
    });
  } catch (error: any) {
    console.error('Paper position POST error:', error);
    return res.status(500).json({ error: 'Failed to create paper position' });
  }
}
