/**
 * Daily loss tracking and limit enforcement.
 * Pure functions, no I/O.
 *
 * Trading day is defined in IST (Asia/Kolkata, UTC+5:30).
 * A new trading day starts at 00:00 IST.
 */

export interface DailyPnLItem {
  realized_pnl: number | null;
  exit_filled_at: string | null;
  status: string;
}

export interface DailyLossCheckInput {
  dailyPnL: number;        // rupees; negative = loss
  totalCapital: number;
  /** Daily loss limit as % of capital. e.g. 6 means 6%. */
  limitPct?: number;
}

export interface DailyLossCheckResult {
  allowed: boolean;
  breached: boolean;
  /** Loss as % of capital (always ≥ 0). 0 if in profit. */
  lossPct: number;
  /** % remaining before breach. 0 if breached. Equal to limitPct if no loss. */
  remainingPct: number;
  limitPct: number;
}

// ---------- Trading day helpers ----------

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

function toISTDate(d: Date | string): Date {
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Date(date.getTime() + IST_OFFSET_MS);
}

function istDayKey(d: Date | string): string {
  const ist = toISTDate(d);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const day = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Returns true if both timestamps fall in the same IST calendar day.
 * Trading day boundary: 00:00 IST (18:30 UTC the prior day).
 */
export function isSameTradingDay(a: string | Date, b: string | Date): boolean {
  if (!a || !b) return false;
  return istDayKey(a) === istDayKey(b);
}

// ---------- Daily P&L computation ----------

/**
 * Sum realized P&L from exited trades in the same IST trading day as `now`.
 * Only items with both `realized_pnl` and `exit_filled_at` set are counted.
 */
export function computeDailyPnL(items: DailyPnLItem[], now: Date | string): number {
  const todayKey = istDayKey(now);
  return items.reduce((sum, item) => {
    if (item.realized_pnl == null) return sum;
    if (!item.exit_filled_at) return sum;
    if (istDayKey(item.exit_filled_at) !== todayKey) return sum;
    return sum + (Number.isFinite(item.realized_pnl) ? item.realized_pnl : 0);
  }, 0);
}

// ---------- Daily loss check ----------

/**
 * Check whether the daily loss limit has been breached.
 * Used to block new order submissions.
 */
export function checkDailyLossLimit(input: DailyLossCheckInput): DailyLossCheckResult {
  const { dailyPnL, totalCapital, limitPct } = input;
  const effectiveLimit = limitPct ?? Infinity;

  // Profit or zero: always allowed.
  if (dailyPnL >= 0) {
    return {
      allowed: true,
      breached: false,
      lossPct: 0,
      remainingPct: Number.isFinite(effectiveLimit) ? effectiveLimit : 0,
      limitPct: Number.isFinite(effectiveLimit) ? effectiveLimit : 0,
    };
  }

  // Loss: compute as % of capital.
  const lossRupees = -dailyPnL; // positive number
  const lossPct = totalCapital > 0 ? (lossRupees / totalCapital) * 100 : lossRupees; // fall back to absolute when capital=0
  const breached = lossPct >= effectiveLimit;
  const remainingPct = Math.max(0, effectiveLimit - lossPct);

  return {
    allowed: !breached,
    breached,
    lossPct: Number(lossPct.toFixed(2)),
    remainingPct: Number(remainingPct.toFixed(2)),
    limitPct: Number.isFinite(effectiveLimit) ? effectiveLimit : 0,
  };
}
