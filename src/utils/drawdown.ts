/**
 * Pure drawdown analysis helpers.
 *
 * Drawdown = peak-to-trough decline of cumulative equity.
 * - Equity curve = starting capital + cumulative closed-trade P&L over time.
 * - At any point, "underwater" if equity < running peak.
 * - drawdownPct = (equity - peak) / peak
 * - underwaterDays = days since the most recent peak
 */

export interface DrawdownTrade {
  id: string;
  exit_filled_at: string | null;
  realized_pnl: number | null;
}

export interface EquityPoint {
  /** ISO date (or "now" marker for starting capital) */
  date: string;
  equity: number;
  peak: number;
}

export interface DrawdownPoint {
  date: string;
  equity: number;
  peak: number;
  /** Negative when below peak, 0 at or above peak */
  drawdownPct: number;
  underwaterDays: number;
}

export interface DrawdownSummary {
  maxDrawdownPct: number;          // negative or 0
  maxDrawdownAbsolute: number;     // negative or 0
  peakDate: string | null;
  troughDate: string | null;
  recoveryDate: string | null;
  currentDrawdownPct: number;
  longestUnderwaterDays: number;
  totalClosedTrades: number;
  finalEquity: number;
  finalReturnPct: number;
  startingCapital: number;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Build the equity curve from closed trades.
 * Returns points in chronological order, starting with the initial capital.
 */
export function buildEquityCurve(
  trades: DrawdownTrade[],
  startingCapital: number,
): EquityPoint[] {
  const closed = trades
    .filter((t) => t.exit_filled_at && t.realized_pnl != null)
    .map((t) => ({ date: t.exit_filled_at as string, pnl: t.realized_pnl as number }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (closed.length === 0) {
    return [{ date: 'now', equity: startingCapital, peak: startingCapital }];
  }

  const points: EquityPoint[] = [];
  let equity = startingCapital;
  let peak = startingCapital;

  points.push({ date: 'start', equity, peak });

  for (const t of closed) {
    equity += t.pnl;
    if (equity > peak) peak = equity;
    points.push({ date: t.date, equity, peak });
  }

  return points;
}

/**
 * Compute drawdown per point: percent and underwater-day count.
 */
export function computeDrawdowns(curve: EquityPoint[]): DrawdownPoint[] {
  return curve.map((p, idx) => {
    const drawdownPct = p.peak > 0 ? ((p.equity - p.peak) / p.peak) * 100 : 0;
    let underwaterDays = 0;
    if (idx > 0 && drawdownPct < 0) {
      // Find the most recent index where equity was at peak (or peak rose)
      let lastPeakIdx = idx;
      for (let i = idx; i >= 0; i--) {
        if (curve[i].equity === curve[i].peak && i < idx) {
          lastPeakIdx = i;
          break;
        }
        if (i === 0) lastPeakIdx = 0;
      }
      const peakDate = curve[lastPeakIdx].date;
      if (peakDate !== 'start' && peakDate !== 'now') {
        const peakMs = new Date(peakDate).getTime();
        const curMs = p.date === 'start' || p.date === 'now' ? Date.now() : new Date(p.date).getTime();
        underwaterDays = Math.max(0, Math.floor((curMs - peakMs) / ONE_DAY_MS));
      } else {
        // No subsequent peak yet — count days since start
        underwaterDays = idx;
      }
    }
    return { ...p, drawdownPct, underwaterDays };
  });
}

/**
 * Find the worst drawdown episode: peak → trough → recovery (or null if never).
 */
function findWorstEpisode(curve: DrawdownPoint[]): {
  peakDate: string | null;
  troughDate: string | null;
  recoveryDate: string | null;
  maxDrawdownPct: number;
  maxDrawdownAbsolute: number;
} {
  let worst: DrawdownPoint = curve[0];
  for (const p of curve) {
    if (p.drawdownPct < worst.drawdownPct) worst = p;
  }
  if (worst.drawdownPct === 0) {
    return { peakDate: null, troughDate: null, recoveryDate: null, maxDrawdownPct: 0, maxDrawdownAbsolute: 0 };
  }

  // peakDate = the most recent point at-or-before trough where equity === peak
  let peakIdx = 0;
  for (let i = 0; i < curve.length; i++) {
    if (curve[i].equity === worst.peak) peakIdx = i;
    if (i >= curve.indexOf(worst)) break;
  }

  // recoveryDate = first point after trough where drawdownPct returns to 0
  const troughIdx = curve.indexOf(worst);
  let recoveryIdx = -1;
  for (let i = troughIdx + 1; i < curve.length; i++) {
    if (curve[i].drawdownPct === 0) {
      recoveryIdx = i;
      break;
    }
  }

  const peakDate = peakIdx < curve.length ? curve[peakIdx].date : null;
  const troughDate = curve[troughIdx].date;
  const recoveryDate = recoveryIdx === -1 ? null : curve[recoveryIdx].date;
  const maxDrawdownAbsolute = curve[troughIdx].equity - curve[troughIdx].peak;

  return {
    peakDate: peakDate === 'start' || peakDate === 'now' ? null : peakDate,
    troughDate: troughDate === 'start' || troughDate === 'now' ? null : troughDate,
    recoveryDate: recoveryDate === 'start' || recoveryDate === 'now' ? null : recoveryDate,
    maxDrawdownPct: worst.drawdownPct,
    maxDrawdownAbsolute,
  };
}

/**
 * Full drawdown summary over a set of closed trades.
 */
export function summarizeDrawdown(
  trades: DrawdownTrade[],
  startingCapital: number,
): DrawdownSummary {
  const curve = buildEquityCurve(trades, startingCapital);
  const drawdowns = computeDrawdowns(curve);
  const episode = findWorstEpisode(drawdowns);

  // longestUnderwaterDays
  let longestUnderwaterDays = 0;
  for (const d of drawdowns) {
    if (d.underwaterDays > longestUnderwaterDays) longestUnderwaterDays = d.underwaterDays;
  }

  const last = drawdowns[drawdowns.length - 1];
  const totalClosedTrades = trades.filter((t) => t.exit_filled_at && t.realized_pnl != null).length;

  return {
    ...episode,
    currentDrawdownPct: last?.drawdownPct ?? 0,
    longestUnderwaterDays,
    totalClosedTrades,
    finalEquity: last?.equity ?? startingCapital,
    finalReturnPct: startingCapital > 0 ? ((last?.equity ?? startingCapital) - startingCapital) / startingCapital * 100 : 0,
    startingCapital,
  };
}
