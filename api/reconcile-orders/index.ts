import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, kiteRequest, getUserKiteCredentials, UnauthorizedError } from '../kite/_client.js';

interface KiteOrder {
  order_id: string;
  parent_order_id?: string | null;
  exchange_order_id?: string | null;
  tradingsymbol: string;
  exchange: string;
  transaction_type: 'BUY' | 'SELL';
  order_type: string;
  product: string;
  status: string; // OPEN, COMPLETE, CANCELLED, REJECTED, etc.
  quantity: number;
  filled_quantity: number;
  pending_quantity: number;
  average_price: number;
  price: number;
  trigger_price: number;
  validity: string;
  tag?: string | null;
  order_timestamp: string;
  exchange_timestamp?: string | null;
  variety: string;
}

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
  const { user, supabase: userSupabase } = auth;

  try {
    // 1. Fetch all open/pending executions from local DB
    const { data: executions, error: execError } = await userSupabase
      .from('strategy_executions')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending_entry', 'entry_filled', 'gtt_placed', 'target1_hit', 'target2_hit', 'partial_exit']);

    if (execError) throw execError;

    // 2. Fetch all orders from Kite (today's orders by default)
    let kiteOrders: KiteOrder[] = [];
    let kiteError: string | null = null;
    try {
      const credentials = await getUserKiteCredentials(user.id);
      const response = credentials ? await kiteRequest(credentials, 'GET', '/orders') : null;
      kiteOrders = Array.isArray(response) ? response : (response?.data || []);
    } catch (err: any) {
      console.warn('Kite order fetch failed:', err.message);
      kiteError = err.message;
    }

    // 3. Reconcile
    const discrepancies: Discrepancy[] = [];

    // Index kite orders by order_id for fast lookup
    const kiteOrderMap = new Map<string, KiteOrder>();
    for (const ko of kiteOrders) {
      kiteOrderMap.set(ko.order_id, ko);
    }

    // Index executions by entry_order_id and exit_order_id
    const localOrderMap = new Map<string, { execution: any; role: 'entry' | 'exit' }>();
    for (const ex of executions || []) {
      if (ex.entry_order_id) {
        localOrderMap.set(ex.entry_order_id, { execution: ex, role: 'entry' });
      }
      if (ex.exit_order_id) {
        localOrderMap.set(ex.exit_order_id, { execution: ex, role: 'exit' });
      }
      if (ex.gtt_id) {
        // GTTs aren't in /orders; we track them separately
      }
    }

    // Check each local execution against Kite
    for (const ex of executions || []) {
      // Check entry order
      if (ex.entry_order_id) {
        const ko = kiteOrderMap.get(ex.entry_order_id);
        if (!ko) {
          discrepancies.push({
            type: 'missing_in_kite',
            severity: 'critical',
            symbol: ex.symbol,
            order_id: ex.entry_order_id,
            execution_id: ex.id,
            message: `Entry order ${ex.entry_order_id} for ${ex.symbol} not found on Kite`,
            local_value: ex.status,
          });
          continue;
        }

        // Compare quantity
        if (ko.quantity !== ex.quantity) {
          discrepancies.push({
            type: 'quantity_mismatch',
            severity: 'warning',
            symbol: ex.symbol,
            order_id: ko.order_id,
            execution_id: ex.id,
            message: `Entry order quantity mismatch: local=${ex.quantity}, kite=${ko.quantity}`,
            local_value: ex.quantity,
            kite_value: ko.quantity,
          });
        }

        // Compare price for limit orders
        if (ko.order_type === 'LIMIT' && ex.entry_price && ko.price && Math.abs(ko.price - ex.entry_price) > 0.01) {
          discrepancies.push({
            type: 'price_mismatch',
            severity: 'warning',
            symbol: ex.symbol,
            order_id: ko.order_id,
            execution_id: ex.id,
            message: `Entry price mismatch: local=${ex.entry_price}, kite=${ko.price}`,
            local_value: ex.entry_price,
            kite_value: ko.price,
          });
        }

        // Check status consistency
        const kiteStatusNormalized = ko.status === 'COMPLETE' ? 'entry_filled' :
                                     ko.status === 'OPEN' || ko.status === 'TRIGGER PENDING' ? 'pending_entry' :
                                     ko.status === 'CANCELLED' ? 'cancelled' :
                                     ko.status === 'REJECTED' ? 'rejected' : ko.status.toLowerCase();

        // Local status reflects what we expect
        if (ko.status === 'COMPLETE' && ex.status !== 'entry_filled' && ex.status !== 'gtt_placed' && ex.status !== 'target1_hit' && ex.status !== 'target2_hit' && ex.status !== 'partial_exit' && ex.status !== 'manually_exited') {
          discrepancies.push({
            type: 'status_mismatch',
            severity: 'warning',
            symbol: ex.symbol,
            order_id: ko.order_id,
            execution_id: ex.id,
            message: `Entry filled on Kite but local status is '${ex.status}'`,
            local_value: ex.status,
            kite_value: 'COMPLETE',
          });
        }

        if (ko.status === 'REJECTED' && ex.status !== 'rejected' && ex.status !== 'cancelled') {
          discrepancies.push({
            type: 'status_mismatch',
            severity: 'critical',
            symbol: ex.symbol,
            order_id: ko.order_id,
            execution_id: ex.id,
            message: `Entry order rejected on Kite but local status is '${ex.status}'`,
            local_value: ex.status,
            kite_value: 'REJECTED',
          });
        }
      }

      // Check exit order
      if (ex.exit_order_id) {
        const ko = kiteOrderMap.get(ex.exit_order_id);
        if (!ko) {
          discrepancies.push({
            type: 'missing_in_kite',
            severity: 'critical',
            symbol: ex.symbol,
            order_id: ex.exit_order_id,
            execution_id: ex.id,
            message: `Exit order ${ex.exit_order_id} for ${ex.symbol} not found on Kite`,
            local_value: ex.status,
          });
        }
      }
    }

    // Check for extra orders on Kite (not in local DB) that match our executions
    // This catches orders that were placed but never tracked
    for (const ko of kiteOrders) {
      if (ko.status === 'COMPLETE' || ko.status === 'OPEN') {
        if (!localOrderMap.has(ko.order_id)) {
          // Only flag if it's tagged with one of our strategy tags or recent
          const orderAge = Date.now() - new Date(ko.order_timestamp).getTime();
          if (orderAge < 7 * 24 * 60 * 60 * 1000) { // within 7 days
            // Only flag if it might be ours (has a tag, or is a strategy-like order)
            // Skip — too noisy to flag all untracked orders
          }
        }
      }
    }

    // Summary
    const summary = {
      localExecutionsCount: executions?.length || 0,
      kiteOrdersCount: kiteOrders.length,
      discrepancyCount: discrepancies.length,
      criticalCount: discrepancies.filter(d => d.severity === 'critical').length,
      warningCount: discrepancies.filter(d => d.severity === 'warning').length,
    };

    // If POST, also auto-correct safe discrepancies
    let autoCorrections: any[] = [];
    if (req.method === 'POST' && req.body?.autoCorrect) {
      for (const d of discrepancies) {
        if (d.type === 'status_mismatch' && d.severity === 'warning' && d.kite_value === 'COMPLETE' && d.execution_id) {
          // Mark as filled if Kite shows COMPLETE
          const ko = kiteOrderMap.get(d.order_id!);
          if (ko) {
            const { error: updateError } = await userSupabase
              .from('strategy_executions')
              .update({
                status: 'entry_filled',
                entry_filled_at: ko.exchange_timestamp || ko.order_timestamp,
                entry_filled_price: ko.average_price,
                updated_at: new Date().toISOString(),
              })
              .eq('id', d.execution_id)
              .eq('user_id', user.id);

            if (!updateError) {
              autoCorrections.push({
                execution_id: d.execution_id,
                order_id: d.order_id,
                old_status: d.local_value,
                new_status: 'entry_filled',
                filled_price: ko.average_price,
              });
            }
          }
        }
      }
    }

    return res.status(200).json({
      summary,
      discrepancies,
      autoCorrections,
      kiteError,
      reconciledAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Reconcile orders error:', error);
    if (error.message === 'Unauthorized') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
