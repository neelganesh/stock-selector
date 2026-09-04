import { describe, it, expect } from 'vitest';
import {
  checkDailyLossLimit,
  computeDailyPnL,
  isSameTradingDay,
  type DailyPnLItem,
} from '../dailyLoss';

const makeItem = (overrides: Partial<DailyPnLItem> = {}): DailyPnLItem => ({
  realized_pnl: 0,
  exit_filled_at: '2025-01-15T10:00:00.000Z',
  status: 'manually_exited',
  ...overrides,
});

describe('isSameTradingDay', () => {
  it('returns true for two timestamps in the same IST day', () => {
    const a = '2025-01-15T03:00:00.000Z'; // 08:30 IST
    const b = '2025-01-15T11:30:00.000Z'; // 17:00 IST
    expect(isSameTradingDay(a, b)).toBe(true);
  });

  it('returns false when IST day differs', () => {
    const a = '2025-01-15T18:30:00.000Z'; // 00:00 IST next day
    const b = '2025-01-15T03:00:00.000Z'; // 08:30 IST
    expect(isSameTradingDay(a, b)).toBe(false);
  });

  it('handles month boundary', () => {
    const a = '2025-02-28T18:30:00.000Z'; // 00:00 IST Mar 1
    const b = '2025-03-01T03:00:00.000Z'; // 08:30 IST Mar 1
    expect(isSameTradingDay(a, b)).toBe(true);
  });
});

describe('computeDailyPnL', () => {
  it('sums only realized P&L from exited trades in today\'s IST window', () => {
    const items: DailyPnLItem[] = [
      makeItem({ realized_pnl: 1500, exit_filled_at: '2025-01-15T10:00:00.000Z', status: 'manually_exited' }),
      makeItem({ realized_pnl: -800, exit_filled_at: '2025-01-15T11:00:00.000Z', status: 'stop_loss_hit' }),
      makeItem({ realized_pnl: 200, exit_filled_at: '2025-01-14T11:00:00.000Z', status: 'manually_exited' }), // yesterday
    ];
    const total = computeDailyPnL(items, new Date('2025-01-15T12:00:00.000Z'));
    expect(total).toBe(700);
  });

  it('returns 0 when no items provided', () => {
    expect(computeDailyPnL([], new Date())).toBe(0);
  });

  it('skips items with null realized_pnl', () => {
    const items: DailyPnLItem[] = [
      makeItem({ realized_pnl: null as any, exit_filled_at: '2025-01-15T10:00:00.000Z', status: 'manually_exited' }),
      makeItem({ realized_pnl: 500, exit_filled_at: '2025-01-15T10:00:00.000Z', status: 'manually_exited' }),
    ];
    const total = computeDailyPnL(items, new Date('2025-01-15T12:00:00.000Z'));
    expect(total).toBe(500);
  });

  it('skips items without exit_filled_at (still open)', () => {
    const items: DailyPnLItem[] = [
      makeItem({ realized_pnl: 100, exit_filled_at: null as any, status: 'entry_filled' }),
      makeItem({ realized_pnl: 250, exit_filled_at: '2025-01-15T10:00:00.000Z', status: 'manually_exited' }),
    ];
    const total = computeDailyPnL(items, new Date('2025-01-15T12:00:00.000Z'));
    expect(total).toBe(250);
  });

  it('handles negative P&L (losses)', () => {
    const items: DailyPnLItem[] = [
      makeItem({ realized_pnl: -2000, exit_filled_at: '2025-01-15T10:00:00.000Z', status: 'stop_loss_hit' }),
    ];
    expect(computeDailyPnL(items, new Date('2025-01-15T12:00:00.000Z'))).toBe(-2000);
  });
});

describe('checkDailyLossLimit', () => {
  it('passes when daily P&L is positive (no loss)', () => {
    const result = checkDailyLossLimit({
      dailyPnL: 1500,
      totalCapital: 100000,
      limitPct: 6,
    });
    expect(result.allowed).toBe(true);
    expect(result.breached).toBe(false);
    expect(result.remainingPct).toBe(6);
  });

  it('passes when loss is below limit', () => {
    const result = checkDailyLossLimit({
      dailyPnL: -3000, // -3%
      totalCapital: 100000,
      limitPct: 6, // -6%
    });
    expect(result.allowed).toBe(true);
    expect(result.breached).toBe(false);
    expect(result.remainingPct).toBe(3);
  });

  it('fails when loss equals limit exactly', () => {
    const result = checkDailyLossLimit({
      dailyPnL: -6000, // exactly -6%
      totalCapital: 100000,
      limitPct: 6,
    });
    expect(result.allowed).toBe(false);
    expect(result.breached).toBe(true);
    expect(result.remainingPct).toBe(0);
  });

  it('fails when loss exceeds limit', () => {
    const result = checkDailyLossLimit({
      dailyPnL: -8000, // -8%
      totalCapital: 100000,
      limitPct: 6,
    });
    expect(result.allowed).toBe(false);
    expect(result.breached).toBe(true);
    expect(result.remainingPct).toBe(0);
  });

  it('returns allowed=true when limitPct is undefined', () => {
    const result = checkDailyLossLimit({
      dailyPnL: -100000,
      totalCapital: 100000,
      limitPct: undefined,
    });
    expect(result.allowed).toBe(true);
    expect(result.breached).toBe(false);
  });

  it('handles zero capital gracefully (cannot divide)', () => {
    const result = checkDailyLossLimit({
      dailyPnL: -100,
      totalCapital: 0,
      limitPct: 6,
    });
    // With zero capital, percentage is undefined — fall back to absolute loss
    expect(result.allowed).toBe(false);
    expect(result.breached).toBe(true);
  });

  it('exposes loss as positive number for UI display', () => {
    const result = checkDailyLossLimit({
      dailyPnL: -3000,
      totalCapital: 100000,
      limitPct: 6,
    });
    expect(result.lossPct).toBe(3);
  });
});
