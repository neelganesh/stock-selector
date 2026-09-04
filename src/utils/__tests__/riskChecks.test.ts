import { describe, it, expect } from 'vitest';
import {
  evaluatePreTradeRisk,
  checkMaxPositionPct,
  checkMaxSectorPct,
  checkMaxOpenStrategies,
  checkCapitalAvailable,
  checkRiskPerTradeVsConfig,
  checkDailyLossVsConfig,
  type RiskCheckContext,
  type RiskViolation,
} from '../riskChecks';

const makeContext = (overrides: Partial<RiskCheckContext> = {}): RiskCheckContext => ({
  tradeValue: 50000,          // ₹50,000 invested
  tradeRiskAmount: 1000,      // ₹1,000 at risk
  tradeRiskPct: 0.2,          // 0.2% of capital
  sector: 'Energy',
  totalCapital: 500000,       // ₹5 Lakh
  config: {
    totalCapital: 500000,
    riskPerTradePct: 2,       // 2% max risk per trade
    maxPositionPct: 20,        // 20% max position size
    maxSectorPct: 30,          // 30% max sector concentration
    maxOpenStrategies: 5,
    dailyLossLimitPct: 6,
  },
  currentPositions: [
    { symbol: 'RELIANCE', value: 50000, sector: 'Energy' },
    { symbol: 'TCS', value: 30000, sector: 'IT' },
  ],
  openExecutionsCount: 2,
  dailyPnL: 0,
  ...overrides,
});

describe('checkMaxPositionPct', () => {
  it('passes when position % is below max', () => {
    const ctx = makeContext({ tradeValue: 50000 }); // 10% of 500K → passes 20%
    const result = checkMaxPositionPct(ctx);
    expect(result.passed).toBe(true);
  });

  it('fails when position % exceeds max', () => {
    const ctx = makeContext({ tradeValue: 150000 }); // 30% of 500K → fails 20%
    const result = checkMaxPositionPct(ctx);
    expect(result.passed).toBe(false);
    expect(result.violation).toBe('max_position_pct');
    expect(result.details).toMatchObject({
      limit: 20,
      actual: 30,
    });
  });

  it('passes when exactly at limit', () => {
    const ctx = makeContext({ tradeValue: 100000 }); // 20% of 500K → exactly at 20%
    const result = checkMaxPositionPct(ctx);
    expect(result.passed).toBe(true);
  });

  it('passes when maxPositionPct is undefined in config', () => {
    const ctx = makeContext({ config: { ...makeContext().config, maxPositionPct: undefined } });
    const result = checkMaxPositionPct(ctx);
    expect(result.passed).toBe(true);
  });
});

describe('checkMaxSectorPct', () => {
  it('passes when sector exposure is below max', () => {
    // Energy currently has 50K (10%), new trade 50K → total 100K (20%) < 30%
    const ctx = makeContext({ sector: 'Energy', tradeValue: 50000 });
    const result = checkMaxSectorPct(ctx);
    expect(result.passed).toBe(true);
  });

  it('fails when adding trade would exceed sector max', () => {
    // Energy currently 50K (10%), new trade 100K → total 150K (30%) = exactly at 30% → should pass
    const ctx = makeContext({ sector: 'Energy', tradeValue: 100000 });
    const result = checkMaxSectorPct(ctx);
    expect(result.passed).toBe(true); // exactly at limit

    // 110K → 160K (32%) exceeds 30%
    const ctx2 = makeContext({ sector: 'Energy', tradeValue: 110000 });
    const result2 = checkMaxSectorPct(ctx2);
    expect(result2.passed).toBe(false);
    expect(result2.violation).toBe('max_sector_pct');
    expect(result2.details).toMatchObject({
      sector: 'Energy',
      limit: 30,
      actual: 32,
    });
  });

  it('passes for new sector with no existing exposure', () => {
    const ctx = makeContext({ sector: 'Pharma', tradeValue: 50000 });
    const result = checkMaxSectorPct(ctx);
    expect(result.passed).toBe(true);
  });

  it('passes when maxSectorPct is undefined', () => {
    const ctx = makeContext({ config: { ...makeContext().config, maxSectorPct: undefined } });
    const result = checkMaxSectorPct(ctx);
    expect(result.passed).toBe(true);
  });
});

describe('checkMaxOpenStrategies', () => {
  it('passes when below limit', () => {
    // 3 currently open + 1 new = 4 → below 5
    const ctx = makeContext({ openExecutionsCount: 3 });
    const result = checkMaxOpenStrategies(ctx);
    expect(result.passed).toBe(true);
  });

  it('passes when adding would still be at limit', () => {
    // 4 currently open + 1 new = 5 → at limit
    const ctx = makeContext({ openExecutionsCount: 4 });
    const result = checkMaxOpenStrategies(ctx);
    expect(result.passed).toBe(true);
  });

  it('fails when adding would exceed limit', () => {
    // 5 currently open + 1 new = 6 → exceeds 5
    const ctx = makeContext({ openExecutionsCount: 5 });
    const result = checkMaxOpenStrategies(ctx);
    expect(result.passed).toBe(false);
    expect(result.violation).toBe('max_open_strategies');
    expect(result.details).toMatchObject({ limit: 5, actual: 6 });
  });
});

describe('checkCapitalAvailable', () => {
  it('passes when trade is within capital', () => {
    const ctx = makeContext({ tradeValue: 100000 }); // well within 500K
    const result = checkCapitalAvailable(ctx);
    expect(result.passed).toBe(true);
  });

  it('fails when trade exceeds total capital', () => {
    const ctx = makeContext({ tradeValue: 600000 }); // exceeds 500K
    const result = checkCapitalAvailable(ctx);
    expect(result.passed).toBe(false);
    expect(result.violation).toBe('capital_exhausted');
  });
});

describe('checkRiskPerTradeVsConfig', () => {
  it('passes when trade risk % is below configured max', () => {
    const ctx = makeContext({ tradeRiskPct: 1.5 }); // below 2%
    const result = checkRiskPerTradeVsConfig(ctx);
    expect(result.passed).toBe(true);
  });

  it('fails when trade risk % exceeds configured max', () => {
    const ctx = makeContext({ tradeRiskPct: 2.5 }); // above 2%
    const result = checkRiskPerTradeVsConfig(ctx);
    expect(result.passed).toBe(false);
    expect(result.violation).toBe('risk_per_trade_exceeded');
    expect(result.details).toMatchObject({ limit: 2, actual: 2.5 });
  });

  it('passes when exactly at configured risk limit', () => {
    const ctx = makeContext({ tradeRiskPct: 2.0 });
    const result = checkRiskPerTradeVsConfig(ctx);
    expect(result.passed).toBe(true);
  });
});

describe('evaluatePreTradeRisk', () => {
  it('returns passed: true when all checks pass', () => {
    const ctx = makeContext({
      tradeValue: 50000,
      tradeRiskPct: 0.2,
      openExecutionsCount: 1,
    });
    const result = evaluatePreTradeRisk(ctx);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('returns passed: false with all violations when multiple checks fail', () => {
    const ctx = makeContext({
      tradeValue: 150000,    // exceeds max position pct (30% > 20%)
      tradeRiskPct: 3,       // exceeds risk per trade (3% > 2%)
      openExecutionsCount: 6, // exceeds max open strategies (6 > 5)
    });
    const result = evaluatePreTradeRisk(ctx);
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(3);
    const types = result.violations.map((v: RiskViolation) => v.violation);
    expect(types).toContain('max_position_pct');
    expect(types).toContain('risk_per_trade_exceeded');
    expect(types).toContain('max_open_strategies');
  });

  it('returns the first critical violation in blockedReason', () => {
    const ctx = makeContext({ tradeValue: 600000 }); // exceeds capital
    const result = evaluatePreTradeRisk(ctx);
    expect(result.passed).toBe(false);
    expect(result.blockedReason).toBeTruthy();
    expect(result.violations[0].violation).toBe('capital_exhausted');
  });

  it('skips checks when their config values are undefined', () => {
    const ctx = makeContext({
      config: {
        ...makeContext().config,
        maxPositionPct: undefined,
        maxSectorPct: undefined,
        maxOpenStrategies: undefined,
        dailyLossLimitPct: undefined,
      },
      tradeRiskPct: 0.1,
      tradeValue: 50000, // within capital
      openExecutionsCount: 0,
      currentPositions: [],
    });
    const result = evaluatePreTradeRisk(ctx);
    expect(result.passed).toBe(true);
  });

  it('handles zero capital gracefully', () => {
    const ctx = makeContext({ totalCapital: 0, tradeValue: 100 });
    const result = evaluatePreTradeRisk(ctx);
    expect(result.passed).toBe(false);
    expect(result.blockedReason).toBeTruthy();
  });
});

describe('daily loss integration', () => {
  it('blocks when daily loss has reached the limit', () => {
    const ctx = makeContext({
      dailyPnL: -30000, // -6% of 500K
      tradeValue: 50000,
      config: { ...makeContext().config, dailyLossLimitPct: 6 },
    });
    const result = evaluatePreTradeRisk(ctx);
    expect(result.passed).toBe(false);
    const types = result.violations.map((v) => v.violation);
    expect(types).toContain('daily_loss_exceeded');
  });

  it('does not block when daily loss is below limit', () => {
    const ctx = makeContext({
      dailyPnL: -10000, // -2% of 500K
      tradeValue: 50000,
      config: { ...makeContext().config, dailyLossLimitPct: 6 },
    });
    const result = evaluatePreTradeRisk(ctx);
    expect(result.passed).toBe(true);
  });

  it('blocks even when other params are healthy, loss takes priority', () => {
    const ctx = makeContext({
      dailyPnL: -50000, // -10% of 500K, way over 6%
      tradeValue: 10000,
      config: { ...makeContext().config, dailyLossLimitPct: 6 },
      openExecutionsCount: 0,
      currentPositions: [],
    });
    const result = evaluatePreTradeRisk(ctx);
    expect(result.passed).toBe(false);
    expect(result.violations[0].violation).toBe('daily_loss_exceeded');
  });

  it('skips daily loss check when dailyLossLimitPct is undefined', () => {
    const ctx = makeContext({
      dailyPnL: -100000,
      config: { ...makeContext().config, dailyLossLimitPct: undefined },
    });
    const result = evaluatePreTradeRisk(ctx);
    expect(result.passed).toBe(true);
  });
});

describe('checkDailyLossVsConfig', () => {
  it('passes when daily loss is below limit', () => {
    const ctx = makeContext({ dailyPnL: -10000 });
    const result = checkDailyLossVsConfig(ctx);
    expect(result.passed).toBe(true);
  });

  it('fails with daily_loss_exceeded when loss reaches limit', () => {
    const ctx = makeContext({ dailyPnL: -30000 }); // -6% of 500K
    const result = checkDailyLossVsConfig(ctx);
    expect(result.passed).toBe(false);
    expect(result.violation).toBe('daily_loss_exceeded');
  });

  it('skips check when dailyLossLimitPct is undefined', () => {
    const ctx = makeContext({ config: { ...makeContext().config, dailyLossLimitPct: undefined }, dailyPnL: -100000 });
    const result = checkDailyLossVsConfig(ctx);
    expect(result.passed).toBe(true);
  });
});
