// Status transition logic for strategy executions based on Kite order fills.
// Pure functions only — no I/O, no React, no network. Easy to unit-test.

export type ExecutionStatus =
  | 'pending_entry'
  | 'entry_filled'
  | 'gtt_placed'
  | 'target1_hit'
  | 'target2_hit'
  | 'stop_loss_hit'
  | 'partial_exit'
  | 'manually_exited'
  | 'cancelled';

export const TERMINAL_STATUSES: ReadonlySet<ExecutionStatus> = new Set<ExecutionStatus>([
  'target1_hit',
  'target2_hit',
  'stop_loss_hit',
  'manually_exited',
  'cancelled',
]);

export interface ExecutionForDerivation {
  id: string;
  symbol: string;
  status: ExecutionStatus;
  entry_filled_price: number | null;
  stop_loss: number;
  target1: number;
  target2: number | null;
  quantity: number;
  entry_filled_at: string | null;
}

export type KiteOrderStatus = 'OPEN' | 'COMPLETE' | 'CANCELLED' | 'REJECTED' | 'TRIGGER PENDING' | string;

export interface KiteOrderForDerivation {
  order_id: string;
  transaction_type: 'BUY' | 'SELL';
  status: KiteOrderStatus;
  tradingsymbol: string;
  average_price?: number;
  filled_quantity?: number;
  exchange_timestamp?: string;
}

export interface DerivationResult {
  /** Status the execution should have after applying fill evidence. */
  nextStatus: ExecutionStatus;
  /** True if status would change from current to nextStatus. */
  transitioned: boolean;
  /** PATCH payload to apply to strategy_executions. */
  patch: Record<string, unknown>;
  /** Realized P&L (exit - entry) * qty, computed only on terminal SELL fills. */
  realizedPnl?: number;
  /** Entry fill price (when transitioning into entry_filled). */
  entryPrice?: number;
  /** Exit fill price (when transitioning into a terminal status). */
  exitPrice?: number;
  /** Filled quantity for the most recent fill. */
  filledQuantity?: number;
}

const isComplete = (s: KiteOrderStatus) => (s ?? '').toUpperCase() === 'COMPLETE';

const withinTolerance = (a: number, b: number, pct = 0.005) => {
  if (!a || !b) return false;
  return Math.abs(a - b) / b <= pct;
};

/**
 * Classify a completed SELL fill against the execution's planned levels.
 * - target2 (if present) > target1 > stop_loss
 * - Default: partial_exit when price is between levels
 */
function classifyExit(
  avgPrice: number,
  exec: ExecutionForDerivation,
): Extract<ExecutionStatus, 'target2_hit' | 'target1_hit' | 'stop_loss_hit' | 'partial_exit'> {
  // stop_loss is the lower bound; targets are upper bounds.
  if (avgPrice <= exec.stop_loss) return 'stop_loss_hit';
  if (exec.target2 != null && avgPrice >= exec.target2) return 'target2_hit';
  if (withinTolerance(avgPrice, exec.target1) || avgPrice >= exec.target1) return 'target1_hit';
  return 'partial_exit';
}

export function deriveExecutionStatus(
  execution: ExecutionForDerivation,
  orders: KiteOrderForDerivation[],
): DerivationResult {
  const basePatch: Record<string, unknown> = {};
  const noOp: DerivationResult = {
    nextStatus: execution.status,
    transitioned: false,
    patch: basePatch,
  };

  // 1. Once in a terminal state, never regress.
  if (TERMINAL_STATUSES.has(execution.status)) {
    return noOp;
  }

  // 2. Filter orders for this symbol.
  const relevant = orders.filter((o) => o.tradingsymbol === execution.symbol);

  // 3. Handle entry transition: pending_entry → entry_filled on BUY COMPLETE.
  if (execution.status === 'pending_entry') {
    const buy = relevant.find((o) => o.transaction_type === 'BUY' && isComplete(o.status));
    if (buy && buy.average_price != null && (buy.filled_quantity ?? 0) > 0) {
      const entryPrice = buy.average_price;
      const filledQty = buy.filled_quantity!;
      return {
        nextStatus: 'entry_filled',
        transitioned: true,
        entryPrice,
        filledQuantity: filledQty,
        patch: {
          status: 'entry_filled',
          entry_filled_price: entryPrice,
          entry_filled_at: buy.exchange_timestamp ?? new Date().toISOString(),
          quantity: filledQty,
        },
      };
    }
    return noOp;
  }

  // 4. Handle exit transition: entry_filled / gtt_placed / partial_exit → terminal.
  if (['entry_filled', 'gtt_placed', 'partial_exit'].includes(execution.status)) {
    const completeSells = relevant
      .filter((o) => o.transaction_type === 'SELL' && isComplete(o.status) && o.average_price != null)
      .sort((a, b) => {
        const ta = a.exchange_timestamp ? Date.parse(a.exchange_timestamp) : 0;
        const tb = b.exchange_timestamp ? Date.parse(b.exchange_timestamp) : 0;
        return tb - ta; // newest first
      });

    if (completeSells.length === 0) return noOp;

    // Prefer the latest sell; classify against plan.
    const latest = completeSells[0];
    const exitPrice = latest.average_price!;
    const filledQty = latest.filled_quantity ?? execution.quantity;
    const nextStatus = classifyExit(exitPrice, execution);

    const entryPrice = execution.entry_filled_price ?? exitPrice;
    const realizedPnl = (exitPrice - entryPrice) * filledQty;

    return {
      nextStatus,
      transitioned: true,
      exitPrice,
      filledQuantity: filledQty,
      realizedPnl,
      patch: {
        status: nextStatus,
        exit_filled_price: exitPrice,
        exit_filled_at: latest.exchange_timestamp ?? new Date().toISOString(),
        realized_pnl: realizedPnl,
      },
    };
  }

  return noOp;
}
