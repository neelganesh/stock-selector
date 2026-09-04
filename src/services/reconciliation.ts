/**
 * Client-side reconciliation service.
 * Bridges the deriveExecutionStatus pure logic (src/engine/deriveExecutionStatus.ts)
 * with the Supabase order book and Kite orders.
 *
 * Workflow:
 *   1. reconcileExecutions(execs, orders) → { discrepancies, transitions }
 *   2. applyStatusTransitions(transitions) → PATCHes each to /api/executions/[id]
 */

import { deriveExecutionStatus, type ExecutionForDerivation, type KiteOrderForDerivation } from '../engine/deriveExecutionStatus';

// Re-export for convenience
export type { ExecutionForDerivation, KiteOrderForDerivation } from '../engine/deriveExecutionStatus';

export type { ExecutionStatus } from '../engine/deriveExecutionStatus';

// ---------- Types ----------

export interface ExecutionForReconciliation {
  id: string;
  symbol: string;
  status: string;
  entry_order_id?: string | null;
  exit_order_id?: string | null;
  gtt_id?: string | null;
  entry_filled_price: number | null;
  stop_loss: number;
  target1: number;
  target2: number | null;
  quantity: number;
  entry_filled_at: string | null;
  /** Optional: if the user added a note about this execution */
  notes?: string | null;
}

export interface KiteOrderForReconciliation {
  order_id: string;
  parent_order_id?: string | null;
  tradingsymbol: string;
  exchange: string;
  transaction_type: 'BUY' | 'SELL';
  order_type: string;
  product: string;
  status: string;
  quantity: number;
  filled_quantity: number;
  pending_quantity: number;
  average_price: number;
  price: number;
  trigger_price: number;
  order_timestamp: string;
  exchange_timestamp?: string | null;
}

export type DiscrepancyType =
  | 'missing_in_kite'
  | 'missing_in_local'
  | 'quantity_mismatch'
  | 'status_mismatch'
  | 'price_mismatch'
  | 'extra_in_kite';

export type DiscrepancySeverity = 'critical' | 'warning' | 'info';

export interface Discrepancy {
  type: DiscrepancyType;
  severity: DiscrepancySeverity;
  symbol: string;
  order_id?: string;
  execution_id?: string;
  message: string;
  local_value?: unknown;
  kite_value?: unknown;
}

export interface PendingTransition {
  executionId: string;
  fromStatus: string;
  toStatus: string;
  patch: Record<string, unknown>;
  realizedPnl?: number;
  entryPrice?: number;
  exitPrice?: number;
  filledQuantity?: number;
}

export interface ReconciliationResult {
  discrepancies: Discrepancy[];
  transitions: PendingTransition[];
}

// ---------- Core logic ----------

/**
 * Reconcile a list of local executions against Kite orders.
 *
 * Produces two things:
 *  - discrepancies: issues that need user attention
 *  - transitions: auto-applicable status updates
 */
export function reconcileExecutions(
  executions: ExecutionForReconciliation[],
  kiteOrders: KiteOrderForReconciliation[],
): ReconciliationResult {
  const discrepancies: Discrepancy[] = [];
  const transitions: PendingTransition[] = [];

  // Index kite orders by order_id
  const kiteByOrderId = new Map<string, KiteOrderForReconciliation>();
  for (const o of kiteOrders) {
    kiteByOrderId.set(o.order_id, o);
  }

  // Index executions by symbol for fast lookup
  const execsBySymbol = new Map<string, ExecutionForReconciliation[]>();
  for (const ex of executions) {
    const list = execsBySymbol.get(ex.symbol) ?? [];
    list.push(ex);
    execsBySymbol.set(ex.symbol, list);
  }

  // 1. Check each execution against Kite order book
  for (const exec of executions) {
    const symbol = exec.symbol;

    // ── Check entry order ────────────────────────────────────────────────
    if (exec.entry_order_id) {
      const ko = kiteByOrderId.get(exec.entry_order_id);

      if (!ko) {
        // The order is gone from Kite — flag discrepancy but don't auto-transition
        discrepancies.push({
          type: 'missing_in_kite',
          severity: exec.status === 'pending_entry' ? 'critical' : 'warning',
          symbol,
          order_id: exec.entry_order_id,
          execution_id: exec.id,
          message: `Entry order ${exec.entry_order_id} for ${symbol} not found on Kite`,
          local_value: exec.status,
        });
      } else {
        // Quantity mismatch
        if (ko.quantity !== exec.quantity) {
          discrepancies.push({
            type: 'quantity_mismatch',
            severity: 'warning',
            symbol,
            order_id: ko.order_id,
            execution_id: exec.id,
            message: `Entry quantity mismatch: local=${exec.quantity}, kite=${ko.quantity}`,
            local_value: exec.quantity,
            kite_value: ko.quantity,
          });
        }

        // Price mismatch for limit orders
        if (ko.order_type === 'LIMIT' && exec.entry_filled_price && ko.price) {
          const priceDiff = Math.abs(ko.price - exec.entry_filled_price);
          if (priceDiff > 0.01) {
            discrepancies.push({
              type: 'price_mismatch',
              severity: 'info',
              symbol,
              order_id: ko.order_id,
              execution_id: exec.id,
              message: `Entry price mismatch: local=₹${exec.entry_filled_price}, kite=₹${ko.price}`,
              local_value: exec.entry_filled_price,
              kite_value: ko.price,
            });
          }
        }

        // Status mismatch: Kite shows BUY COMPLETE but local is still pending_entry
        if (
          ko.status === 'COMPLETE' &&
          ko.transaction_type === 'BUY' &&
          exec.status === 'pending_entry'
        ) {
          discrepancies.push({
            type: 'status_mismatch',
            severity: 'warning',
            symbol,
            order_id: ko.order_id,
            execution_id: exec.id,
            message: `BUY order completed on Kite but local status is '${exec.status}'`,
            local_value: exec.status,
            kite_value: 'COMPLETE',
          });
        }

        // Status mismatch: rejected order
        if (ko.status === 'REJECTED' && exec.status !== 'cancelled') {
          discrepancies.push({
            type: 'status_mismatch',
            severity: 'critical',
            symbol,
            order_id: ko.order_id,
            execution_id: exec.id,
            message: `Entry order rejected on Kite`,
            local_value: exec.status,
            kite_value: 'REJECTED',
          });
        }
      }
    }

    // ── Derive auto-transition ───────────────────────────────────────────
    const kiteOrdersForSymbol = kiteOrders.filter((o) => o.tradingsymbol === symbol);

    // Map to deriveExecutionStatus format
    const mappedExec: ExecutionForDerivation = {
      id: exec.id,
      symbol,
      status: exec.status as any,
      entry_filled_price: exec.entry_filled_price,
      stop_loss: exec.stop_loss,
      target1: exec.target1,
      target2: exec.target2,
      quantity: exec.quantity,
      entry_filled_at: exec.entry_filled_at,
    };

    const mappedOrders: KiteOrderForDerivation[] = kiteOrdersForSymbol.map((o) => ({
      order_id: o.order_id,
      transaction_type: o.transaction_type,
      status: o.status as any,
      tradingsymbol: o.tradingsymbol,
      average_price: o.average_price,
      filled_quantity: o.filled_quantity,
      exchange_timestamp: o.exchange_timestamp ?? undefined,
    }));

    const derivation = deriveExecutionStatus(mappedExec, mappedOrders);

    if (derivation.transitioned) {
      transitions.push({
        executionId: exec.id,
        fromStatus: exec.status,
        toStatus: derivation.nextStatus,
        patch: derivation.patch,
        realizedPnl: derivation.realizedPnl,
        entryPrice: derivation.entryPrice,
        exitPrice: derivation.exitPrice,
        filledQuantity: derivation.filledQuantity,
      });
    }
  }

  // 2. Check for extra orders in Kite that aren't in any execution
  const knownOrderIds = new Set(
    executions.flatMap((e) => [e.entry_order_id, e.exit_order_id].filter(Boolean)),
  );

  for (const ko of kiteOrders) {
    if (!knownOrderIds.has(ko.order_id)) {
      const orderAge = Date.now() - new Date(ko.order_timestamp).getTime();
      if (orderAge < 7 * 24 * 60 * 60 * 1000 && (ko.status === 'COMPLETE' || ko.status === 'OPEN')) {
        discrepancies.push({
          type: 'extra_in_kite',
          severity: 'info',
          symbol: ko.tradingsymbol,
          order_id: ko.order_id,
          message: `Order ${ko.order_id} (${ko.status}) on Kite not tracked locally`,
          local_value: undefined,
          kite_value: ko.status,
        });
      }
    }
  }

  return { discrepancies, transitions };
}

// ---------- Apply transitions ----------

export interface ApplyResult {
  executionId: string;
  success: boolean;
  error?: string;
}

/**
 * Apply pending transitions by PATCHing each execution to /api/executions/[id].
 * Returns one result per transition.
 */
export async function applyStatusTransitions(
  transitions: PendingTransition[],
): Promise<ApplyResult[]> {
  if (transitions.length === 0) return [];

  const results: ApplyResult[] = await Promise.all(
    transitions.map(async (t) => {
      try {
        const res = await fetch(`/api/executions/${t.executionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(t.patch),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          return {
            executionId: t.executionId,
            success: false,
            error: (body as { error?: string }).error ?? `HTTP ${res.status}`,
          };
        }

        return { executionId: t.executionId, success: true };
      } catch (err: any) {
        return { executionId: t.executionId, success: false, error: err?.message ?? 'Network error' };
      }
    }),
  );

  return results;
}
