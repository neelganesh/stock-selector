import { describe, it, expect } from 'vitest';
import {
  buildEquityCurve,
  computeDrawdowns,
  summarizeDrawdown,
  type DrawdownTrade,
} from '../drawdown';

const trade = (overrides: Partial<DrawdownTrade>): DrawdownTrade => ({
  id: Math.random().toString(36).slice(2),
  exit_filled_at: '2025-01-15T10:00:00.000Z',
  realized_pnl: 1000,
  ...overrides,
});

describe('drawdown', () => {
  describe('buildEquityCurve', () => {
    it('returns starting capital only when no trades', () => {
      const curve = buildEquityCurve([], 100_000);
      expect(curve).toHaveLength(1);
      expect(curve[0].equity).toBe(100_000);
    });

    it('accumulates P&L chronologically', () => {
      const trades: DrawdownTrade[] = [
        trade({ id: 'a', realized_pnl: 1500, exit_filled_at: '2025-01-10T10:00:00.000Z' }),
        trade({ id: 'b', realized_pnl: -300, exit_filled_at: '2025-01-20T10:00:00.000Z' }),
        trade({ id: 'c', realized_pnl: 800, exit_filled_at: '2025-02-05T10:00:00.000Z' }),
      ];
      const curve = buildEquityCurve(trades, 100_000);
      expect(curve.map((p) => p.equity)).toEqual([100_000, 101_500, 101_200, 102_000]);
    });

    it('sorts trades by exit date (not input order)', () => {
      const trades: DrawdownTrade[] = [
        trade({ id: 'a', realized_pnl: 100, exit_filled_at: '2025-02-01T10:00:00.000Z' }),
        trade({ id: 'b', realized_pnl: 200, exit_filled_at: '2025-01-01T10:00:00.000Z' }),
      ];
      const curve = buildEquityCurve(trades, 100_000);
      // Jan 1 trade runs first → equity 100_200, then Feb 1 → 100_300
      expect(curve[1].equity).toBe(100_200);
      expect(curve[2].equity).toBe(100_300);
    });

    it('skips trades without exit_filled_at or with null pnl', () => {
      const trades: DrawdownTrade[] = [
        trade({ id: 'a', realized_pnl: 500, exit_filled_at: '2025-01-10T10:00:00.000Z' }),
        trade({ id: 'b', realized_pnl: null as any, exit_filled_at: '2025-01-15T10:00:00.000Z' }),
        trade({ id: 'c', realized_pnl: 100, exit_filled_at: null as any }),
      ];
      const curve = buildEquityCurve(trades, 100_000);
      expect(curve).toHaveLength(2); // start + 1 closed trade
      expect(curve[1].equity).toBe(100_500);
    });

    it('peak on every point reflects running max', () => {
      const trades: DrawdownTrade[] = [
        trade({ id: 'a', realized_pnl: 1000, exit_filled_at: '2025-01-10T10:00:00.000Z' }),
        trade({ id: 'b', realized_pnl: -1500, exit_filled_at: '2025-01-20T10:00:00.000Z' }),
        trade({ id: 'c', realized_pnl: 500, exit_filled_at: '2025-02-05T10:00:00.000Z' }),
      ];
      const curve = buildEquityCurve(trades, 100_000);
      expect(curve[0].peak).toBe(100_000);
      expect(curve[1].peak).toBe(101_000);
      expect(curve[2].peak).toBe(101_000); // peak doesn't go down
      expect(curve[3].peak).toBe(101_000);
    });
  });

  describe('computeDrawdowns', () => {
    it('returns zero drawdown when equity monotonically increases', () => {
      const trades: DrawdownTrade[] = [
        trade({ id: 'a', realized_pnl: 1000, exit_filled_at: '2025-01-10T10:00:00.000Z' }),
        trade({ id: 'b', realized_pnl: 2000, exit_filled_at: '2025-02-10T10:00:00.000Z' }),
      ];
      const curve = buildEquityCurve(trades, 100_000);
      const drawdowns = computeDrawdowns(curve);
      // All zeros
      expect(drawdowns.every((d) => d.drawdownPct === 0)).toBe(true);
    });

    it('computes percentage drawdown vs running peak', () => {
      const trades: DrawdownTrade[] = [
        trade({ id: 'a', realized_pnl: 1000, exit_filled_at: '2025-01-10T10:00:00.000Z' }),
        trade({ id: 'b', realized_pnl: -1500, exit_filled_at: '2025-01-20T10:00:00.000Z' }),
      ];
      const curve = buildEquityCurve(trades, 100_000);
      const drawdowns = computeDrawdowns(curve);
      // Point at equity 99_500, peak 101_000 → drawdown = (99_500-101_000)/101_000 = -1.485%
      expect(drawdowns[2].drawdownPct).toBeCloseTo(-1.485, 2);
    });

    it('counts underwater days since last peak', () => {
      const trades: DrawdownTrade[] = [
        trade({ id: 'a', realized_pnl: 1000, exit_filled_at: '2025-01-01T10:00:00.000Z' }),
        trade({ id: 'b', realized_pnl: -500, exit_filled_at: '2025-01-10T10:00:00.000Z' }),
        trade({ id: 'c', realized_pnl: -500, exit_filled_at: '2025-01-20T10:00:00.000Z' }),
      ];
      const curve = buildEquityCurve(trades, 100_000);
      const drawdowns = computeDrawdowns(curve);
      // First point: underwater days = 0
      // Second point: 9 days since last peak
      // Third point: 19 days since last peak
      expect(drawdowns[1].underwaterDays).toBe(0);
      expect(drawdowns[2].underwaterDays).toBe(9);
      expect(drawdowns[3].underwaterDays).toBe(19);
    });
  });

  describe('summarizeDrawdown', () => {
    it('handles empty case', () => {
      const summary = summarizeDrawdown([], 100_000);
      expect(summary.maxDrawdownPct).toBe(0);
      expect(summary.maxDrawdownAbsolute).toBe(0);
      expect(summary.currentDrawdownPct).toBe(0);
      expect(summary.totalClosedTrades).toBe(0);
    });

    it('identifies the worst drawdown', () => {
      const trades: DrawdownTrade[] = [
        trade({ id: 'a', realized_pnl: 2000, exit_filled_at: '2025-01-01T10:00:00.000Z' }),
        trade({ id: 'b', realized_pnl: -1500, exit_filled_at: '2025-01-15T10:00:00.000Z' }),
        trade({ id: 'c', realized_pnl: 2000, exit_filled_at: '2025-02-10T10:00:00.000Z' }),
      ];
      const summary = summarizeDrawdown(trades, 100_000);
      expect(summary.maxDrawdownPct).toBeLessThan(0);
      expect(summary.maxDrawdownAbsolute).toBeLessThan(0);
      expect(summary.peakDate).toBe('2025-01-01T10:00:00.000Z');
      expect(summary.troughDate).toBe('2025-01-15T10:00:00.000Z');
      expect(summary.recoveryDate).toBe('2025-02-10T10:00:00.000Z');
    });

    it('marks recoveryDate null if never recovered', () => {
      const trades: DrawdownTrade[] = [
        trade({ id: 'a', realized_pnl: 1000, exit_filled_at: '2025-01-01T10:00:00.000Z' }),
        trade({ id: 'b', realized_pnl: -2000, exit_filled_at: '2025-01-15T10:00:00.000Z' }),
      ];
      const summary = summarizeDrawdown(trades, 100_000);
      expect(summary.recoveryDate).toBeNull();
      expect(summary.currentDrawdownPct).toBeLessThan(0);
    });

    it('computes longest underwater streak', () => {
      const trades: DrawdownTrade[] = [
        trade({ id: 'a', realized_pnl: 2000, exit_filled_at: '2025-01-01T10:00:00.000Z' }),
        trade({ id: 'b', realized_pnl: -1000, exit_filled_at: '2025-01-15T10:00:00.000Z' }),
        trade({ id: 'c', realized_pnl: 500, exit_filled_at: '2025-02-01T10:00:00.000Z' }),
        trade({ id: 'd', realized_pnl: -800, exit_filled_at: '2025-03-01T10:00:00.000Z' }),
      ];
      const summary = summarizeDrawdown(trades, 100_000);
      // The longest underwater streak should be 14 days (Jan 15 → Jan 29 if recovered by Feb 1)
      expect(summary.longestUnderwaterDays).toBeGreaterThanOrEqual(14);
    });
  });
});
