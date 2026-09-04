/**
 * Pre-trade risk checks — pure functions, no I/O.
 * Designed to be extended (Task 15 will add daily-loss checks; Task 16 will read trade journal context).
 *
 * All checks are *gates*: pass = safe to trade, fail = block with reason.
 */

import { checkDailyLossLimit } from './dailyLoss';

export type RiskViolationType =
  | 'max_position_pct'
  | 'max_sector_pct'
  | 'max_open_strategies'
  | 'capital_exhausted'
  | 'risk_per_trade_exceeded'
  | 'daily_loss_exceeded';

export type RiskSeverity = 'critical' | 'warning';

export interface RiskViolation {
  violation: RiskViolationType;
  severity: RiskSeverity;
  message: string;
  details?: Record<string, unknown>;
}

export interface RiskCheckResult {
  passed: boolean;
  violation?: RiskViolationType;
  severity?: RiskSeverity;
  message?: string;
  details?: Record<string, unknown>;
}

export interface RiskConfig {
  totalCapital: number;
  riskPerTradePct: number;
  maxPositionPct?: number;
  maxSectorPct?: number;
  maxOpenStrategies?: number;
  dailyLossLimitPct?: number;
}

export interface PositionSnapshot {
  symbol: string;
  value: number;
  sector: string;
}

export interface RiskCheckContext {
  /** Notional value of the proposed trade (price × qty). */
  tradeValue: number;
  /** Absolute rupees at risk (entry - stopLoss) × qty. */
  tradeRiskAmount: number;
  /** Trade risk as % of totalCapital. */
  tradeRiskPct: number;
  sector: string;
  totalCapital: number;
  config: RiskConfig;
  currentPositions: PositionSnapshot[];
  openExecutionsCount: number;
  /** Optional: realized P&L so far today (negative = loss). */
  dailyPnL?: number;
}

export interface EvaluateResult {
  passed: boolean;
  violations: RiskViolation[];
  /** Convenience: the first critical violation, or null if no blockers. */
  blockedReason: string | null;
}

const pct = (numerator: number, denominator: number): number => {
  if (denominator <= 0) return Infinity;
  return (numerator / denominator) * 100;
};

// ---------- Individual checks ----------

export function checkMaxPositionPct(ctx: RiskCheckContext): RiskCheckResult {
  const limit = ctx.config.maxPositionPct;
  if (limit == null) return { passed: true };
  if (ctx.totalCapital <= 0) {
    return {
      passed: false,
      violation: 'max_position_pct',
      severity: 'critical',
      message: 'Total capital must be positive',
      details: { limit, actual: 0 },
    };
  }
  const actual = pct(ctx.tradeValue, ctx.totalCapital);
  if (actual > limit) {
    return {
      passed: false,
      violation: 'max_position_pct',
      severity: 'critical',
      message: `Position size ${actual.toFixed(1)}% exceeds limit of ${limit}%`,
      details: { limit, actual: Number(actual.toFixed(2)) },
    };
  }
  return { passed: true };
}

export function checkMaxSectorPct(ctx: RiskCheckContext): RiskCheckResult {
  const limit = ctx.config.maxSectorPct;
  if (limit == null) return { passed: true };
  if (ctx.totalCapital <= 0) {
    return {
      passed: false,
      violation: 'max_sector_pct',
      severity: 'critical',
      message: 'Total capital must be positive',
      details: { sector: ctx.sector, limit, actual: 0 },
    };
  }
  const existing = ctx.currentPositions
    .filter((p) => p.sector === ctx.sector)
    .reduce((sum, p) => sum + p.value, 0);
  const projected = existing + ctx.tradeValue;
  const actual = pct(projected, ctx.totalCapital);
  if (actual > limit) {
    return {
      passed: false,
      violation: 'max_sector_pct',
      severity: 'warning',
      message: `Sector ${ctx.sector} exposure ${actual.toFixed(1)}% would exceed limit of ${limit}%`,
      details: { sector: ctx.sector, limit, actual: Number(actual.toFixed(2)), existing, projected },
    };
  }
  return { passed: true };
}

export function checkMaxOpenStrategies(ctx: RiskCheckContext): RiskCheckResult {
  const limit = ctx.config.maxOpenStrategies;
  if (limit == null) return { passed: true };
  // The check operates on the count that *would* exist after this trade is opened.
  const actual = ctx.openExecutionsCount + 1;
  if (actual > limit) {
    return {
      passed: false,
      violation: 'max_open_strategies',
      severity: 'critical',
      message: `Open strategies ${actual} would exceed limit of ${limit}`,
      details: { limit, actual },
    };
  }
  return { passed: true };
}

export function checkCapitalAvailable(ctx: RiskCheckContext): RiskCheckResult {
  if (ctx.totalCapital <= 0) {
    return {
      passed: false,
      violation: 'capital_exhausted',
      severity: 'critical',
      message: 'No trading capital configured',
      details: { totalCapital: 0, required: ctx.tradeValue },
    };
  }
  if (ctx.tradeValue > ctx.totalCapital) {
    return {
      passed: false,
      violation: 'capital_exhausted',
      severity: 'critical',
      message: `Trade value ₹${ctx.tradeValue} exceeds capital ₹${ctx.totalCapital}`,
      details: { totalCapital: ctx.totalCapital, required: ctx.tradeValue },
    };
  }
  return { passed: true };
}

export function checkRiskPerTradeVsConfig(ctx: RiskCheckContext): RiskCheckResult {
  const limit = ctx.config.riskPerTradePct;
  if (limit == null) return { passed: true };
  if (ctx.tradeRiskPct > limit) {
    return {
      passed: false,
      violation: 'risk_per_trade_exceeded',
      severity: 'critical',
      message: `Trade risk ${ctx.tradeRiskPct.toFixed(2)}% exceeds limit of ${limit}%`,
      details: { limit, actual: ctx.tradeRiskPct },
    };
  }
  return { passed: true };
}

export function checkDailyLossVsConfig(ctx: RiskCheckContext): RiskCheckResult {
  const limit = ctx.config.dailyLossLimitPct;
  if (limit == null) return { passed: true };
  const result = checkDailyLossLimit({
    dailyPnL: ctx.dailyPnL ?? 0,
    totalCapital: ctx.totalCapital,
    limitPct: limit,
  });
  if (!result.allowed) {
    return {
      passed: false,
      violation: 'daily_loss_exceeded',
      severity: 'critical',
      message: `Daily loss ${result.lossPct.toFixed(2)}% has reached limit of ${limit}%`,
      details: {
        limit,
        lossPct: result.lossPct,
        remainingPct: result.remainingPct,
        dailyPnL: ctx.dailyPnL ?? 0,
      },
    };
  }
  return { passed: true };
}

// ---------- Aggregator ----------

/**
 * Run all pre-trade risk checks. Returns all violations (not just first),
 * so the UI can show multiple issues at once. `blockedReason` is a convenience
 * for the first critical violation to use in toasts.
 */
export function evaluatePreTradeRisk(ctx: RiskCheckContext): EvaluateResult {
  const checks: Array<{ result: RiskCheckResult; violation: RiskViolation }> = [];

  // Order matters for the `blockedReason` priority.
  const checksToRun: Array<{ fn: (c: RiskCheckContext) => RiskCheckResult; type: RiskViolationType }> = [
    { fn: checkDailyLossVsConfig, type: 'daily_loss_exceeded' },
    { fn: checkCapitalAvailable, type: 'capital_exhausted' },
    { fn: checkMaxPositionPct, type: 'max_position_pct' },
    { fn: checkMaxOpenStrategies, type: 'max_open_strategies' },
    { fn: checkRiskPerTradeVsConfig, type: 'risk_per_trade_exceeded' },
    { fn: checkMaxSectorPct, type: 'max_sector_pct' },
  ];

  for (const { fn, type } of checksToRun) {
    const result = fn(ctx);
    if (!result.passed) {
      checks.push({
        result,
        violation: {
          violation: result.violation ?? type,
          severity: result.severity ?? 'warning',
          message: result.message ?? 'Risk check failed',
          details: result.details,
        },
      });
    }
  }

  const violations = checks.map((c) => c.violation);
  const firstCritical = violations.find((v) => v.severity === 'critical') ?? violations[0];

  return {
    passed: violations.length === 0,
    violations,
    blockedReason: firstCritical?.message ?? null,
  };
}
