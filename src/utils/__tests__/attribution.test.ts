import { describe, it, expect } from 'vitest';
import {
  bucketByMonth,
  bucketByQuarter,
  bucketByFinancialYear,
  type AttributionItem,
} from '../attribution';

const makeItem = (overrides: Partial<AttributionItem> = {}): AttributionItem => ({
  id: 'x',
  realized_pnl: 1000,
  exit_filled_at: '2025-01-15T10:00:00.000Z',
  entry_filled_at: '2025-01-10T10:00:00.000Z',
  strategy_id: 's1',
  strategy_name: 'Swing',
  symbol: 'RELIANCE',
  ...overrides,
});

describe('bucketByMonth', () => {
  it('groups items by YYYY-MM key in IST', () => {
    const items: AttributionItem[] = [
      makeItem({ id: 'a', realized_pnl: 500, exit_filled_at: '2025-01-15T10:00:00.000Z' }),
      makeItem({ id: 'b', realized_pnl: -200, exit_filled_at: '2025-01-20T10:00:00.000Z' }),
      makeItem({ id: 'c', realized_pnl: 800, exit_filled_at: '2025-02-05T10:00:00.000Z' }),
    ];
    const buckets = bucketByMonth(items);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].key).toBe('2025-01');
    expect(buckets[0].netPnl).toBe(300);
    expect(buckets[0].tradeCount).toBe(2);
    expect(buckets[0].winCount).toBe(1);
    expect(buckets[0].lossCount).toBe(1);
    expect(buckets[1].key).toBe('2025-02');
    expect(buckets[1].netPnl).toBe(800);
  });

  it('handles items across the IST new-year boundary correctly', () => {
    // 2025-01-01 00:30 IST = 2024-12-31 19:00 UTC → goes into 2025-01 IST bucket
    const items: AttributionItem[] = [
      makeItem({ id: 'a', realized_pnl: 100, exit_filled_at: '2024-12-31T19:00:00.000Z' }),
    ];
    const buckets = bucketByMonth(items);
    expect(buckets[0].key).toBe('2025-01');
    expect(buckets[0].netPnl).toBe(100);
  });

  it('skips items with null realized_pnl and exit_filled_at', () => {
    const items: AttributionItem[] = [
      makeItem({ id: 'a', realized_pnl: null as any, exit_filled_at: '2025-01-15T10:00:00.000Z' }),
      makeItem({ id: 'b', realized_pnl: 500, exit_filled_at: null as any }),
    ];
    const buckets = bucketByMonth(items);
    expect(buckets).toEqual([]);
  });

  it('returns buckets sorted ascending by key', () => {
    const items: AttributionItem[] = [
      makeItem({ id: 'a', realized_pnl: 100, exit_filled_at: '2025-03-10T10:00:00.000Z' }),
      makeItem({ id: 'b', realized_pnl: 200, exit_filled_at: '2025-01-10T10:00:00.000Z' }),
      makeItem({ id: 'c', realized_pnl: 300, exit_filled_at: '2025-02-10T10:00:00.000Z' }),
    ];
    const buckets = bucketByMonth(items);
    expect(buckets.map((b) => b.key)).toEqual(['2025-01', '2025-02', '2025-03']);
  });

  it('computes per-strategy net P&L breakdown', () => {
    const items: AttributionItem[] = [
      makeItem({ id: 'a', realized_pnl: 500, strategy_id: 's1', exit_filled_at: '2025-01-15T10:00:00.000Z' }),
      makeItem({ id: 'b', realized_pnl: -200, strategy_id: 's2', exit_filled_at: '2025-01-20T10:00:00.000Z' }),
    ];
    const buckets = bucketByMonth(items);
    expect(buckets[0].byStrategy).toEqual([
      { strategyId: 's1', strategyName: 'Swing', netPnl: 500, tradeCount: 1 },
      { strategyId: 's2', strategyName: 'Swing', netPnl: -200, tradeCount: 1 },
    ]);
  });

  it('returns empty array when no items', () => {
    expect(bucketByMonth([])).toEqual([]);
  });
});

describe('bucketByQuarter', () => {
  it('groups by YYYY-Qn keys', () => {
    const items: AttributionItem[] = [
      makeItem({ id: 'a', realized_pnl: 500, exit_filled_at: '2025-01-15T10:00:00.000Z' }),
      makeItem({ id: 'b', realized_pnl: -200, exit_filled_at: '2025-04-15T10:00:00.000Z' }),
      makeItem({ id: 'c', realized_pnl: 100, exit_filled_at: '2025-09-15T10:00:00.000Z' }),
    ];
    const buckets = bucketByQuarter(items);
    expect(buckets.map((b) => b.key)).toEqual(['2025-Q1', '2025-Q2', '2025-Q3']);
    expect(buckets[0].netPnl).toBe(500);
    expect(buckets[1].netPnl).toBe(-200);
    expect(buckets[2].netPnl).toBe(100);
  });
});

describe('bucketByFinancialYear', () => {
  it('groups by FY YYYY-YY where FY starts in April (IST)', () => {
    // 2025-01-15 → FY 2024-25
    // 2025-04-15 → FY 2025-26
    const items: AttributionItem[] = [
      makeItem({ id: 'a', realized_pnl: 500, exit_filled_at: '2025-01-15T10:00:00.000Z' }),
      makeItem({ id: 'b', realized_pnl: 700, exit_filled_at: '2025-04-15T10:00:00.000Z' }),
      makeItem({ id: 'c', realized_pnl: 300, exit_filled_at: '2025-03-15T10:00:00.000Z' }),
    ];
    const buckets = bucketByFinancialYear(items);
    expect(buckets.map((b) => b.key)).toEqual(['FY 2024-25', 'FY 2025-26']);
    expect(buckets[0].netPnl).toBe(800); // Jan + Mar 2025
    expect(buckets[1].netPnl).toBe(700);
  });
});
