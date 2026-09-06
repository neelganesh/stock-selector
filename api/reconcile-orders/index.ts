import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, UnauthorizedError, getSupabaseAdmin } from '../_auth.js';

interface Discrepancy {
  type: 'missing_in_local' | 'missing_in_kite' | 'quantity_mismatch' | 'status_mismatch' | 'price_mismatch' | 'extra_in_kite';
  severity: 'critical' | 'warning' | 'info';
  symbol: string;
  order_id?: string;
  execution_id?: string;
  message: string;
  local_value?: any;
  kite_value?: any;
}

/**
 * Order Reconciliation API
 * 
 * GET /api/reconcile-orders
 *   Returns reconciliation status between local executions and Kite orders.
 *   Note: With Publisher mode, Kite orders must be fetched client-side.
 *   This endpoint only returns local execution status.
 * 
 * POST /api/reconcile-orders
 *   Body: { autoCorrect: true, kiteOrders: [...] }
 *   Attempts to auto-correct safe discrepancies using Kite orders from the browser.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
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

  const { user } = auth;
  const supabase = getSupabaseAdmin();

  try {
    // 1. Fetch all open/pending executions from local DB
    const { data: executions, error: execError } = await supabase
      .from('strategy_executions')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'entry_placed', 'entry_filled', 'gtt_placed', 'target1_hit', 'target2_hit']);

    if (execError) throw execError;

    // Note: Kite order fetching is handled client-side via Publisher mode
    // The browser-based Kite Publisher JS handles all Kite API calls
    
    // Check for executions that might need attention
    const discrepancies: Discrepancy[] = [];
    
    for (const ex of executions || []) {
      if (ex.status === 'entry_placed' && ex.created_at) {
        const orderAge = Date.now() - new Date(ex.created_at).getTime();
        const hourAge = orderAge / (1000 * 60 * 60);
        
        if (hourAge > 24) {
          discrepancies.push({
            type: 'status_mismatch',
            severity: 'warning',
            symbol: ex.symbol,
            order_id: ex.entry_order_id || undefined,
            execution_id: ex.id,
            message: `Entry order placed ${hourAge.toFixed(1)} hours ago but not filled. Check Kite manually.`,
            local_value: ex.status,
            kite_value: 'unknown',
          });
        }
      }
    }

    const summary = {
      localExecutionsCount: executions?.length || 0,
      kiteOrdersCount: 0, // Fetched client-side in Publisher mode
      discrepancyCount: discrepancies.length,
      criticalCount: discrepancies.filter(d => d.severity === 'critical').length,
      warningCount: discrepancies.filter(d => d.severity === 'warning').length,
      note: 'Kite orders are fetched client-side via Publisher mode. Use the browser to reconcile with live Kite data.',
    };

    const autoCorrections: any[] = [];

    return res.status(200).json({
      summary,
      discrepancies,
      autoCorrections,
      kiteError: null,
      reconciledAt: new Date().toISOString(),
      publisherMode: true,
    });
  } catch (error: any) {
    console.error('Reconcile orders error:', error);
    if (error.message === 'Unauthorized') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
