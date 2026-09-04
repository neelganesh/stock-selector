/**
 * Pure bucketing helpers for performance attribution.
 * No I/O. All buckets are computed in IST (UTC+5:30).
 */

export interface AttributionItem {
  id: string;
  realized_pnl: number | null;
  /** ISO string. If null, the trade is still open and excluded from closed-period totals. */
  exit_filled_at: string | null;
  entry_filled_at: string | null;
  strategy_id: string;
  strategy_name: string;
  symbol: string;
}

export interface StrategyContribution {
  strategyId: string;
  strategyName: string;
  netPnl: number;
  tradeCount: number;
}

export interface AttributionBucket {
  key: string;            // "2025-01", "2025-Q1", "FY 2024-25"
  label: string;          // human-readable label
  startDate: Date;        // first instant of the period (UTC)
  endDate: Date;          // first instant of next period (exclusive)
  netPnl: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  /** Aggregated by strategy, sorted desc by |netPnl| */
  byStrategy: StrategyContribution[];
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function toISTDate(d: string | Date): Date {
  return new Date(typeof d === 'string' ? new Date(d).getTime() + IST_OFFSET_MS : d.getTime() + IST_OFFSET_MS);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// ---------- Month bucketing ----------

export function monthKey(d: string | Date): string {
  const ist = toISTDate(d);
  return `${ist.getUTCFullYear()}-${pad2(ist.getUTCMonth() + 1)}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map((s) => parseInt(s, 10));
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[m - 1]} ${y}`;
}

export function monthBounds(key: string): { start: Date; end: Date } {
  const [y, m] = key.split('-').map((s) => parseInt(s, 10));
  const startUtc = Date.UTC(y, m - 1, 1) - IST_OFFSET_MS;
  const endUtc = Date.UTC(y, m, 1) - IST_OFFSET_MS;
  return { start: new Date(startUtc), end: new Date(endUtc) };
}

// ---------- Quarter bucketing ----------

export function quarterKey(d: string | Date): string {
  const ist = toISTDate(d);
  const q = Math.floor(ist.getUTCMonth() / 3) + 1;
  return `${ist.getUTCFullYear()}-Q${q}`;
}

export function quarterLabel(key: string): string {
  // key = "2025-Q1" → "2025 Q1"
  return key.replace('-Q', ' Q');
}

export function quarterBounds(key: string): { start: Date; end: Date } {
  const [yStr, qStr] = key.split('-Q');
  const y = parseInt(yStr, 10);
  const q = parseInt(qStr, 10);
  const startMonth = (q - 1) * 3;
  const startUtc = Date.UTC(y, startMonth, 1) - IST_OFFSET_MS;
  const endUtc = Date.UTC(y, startMonth + 3, 1) - IST_OFFSET_MS;
  return { start: new Date(startUtc), end: new Date(endUtc) };
}

// ---------- Financial year (India: Apr–Mar) bucketing ----------

export function financialYearKey(d: string | Date): string {
  const ist = toISTDate(d);
  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth(); // 0-based
  // Apr (3) starts a new FY. FY 2024-25 = Apr 2024 → Mar 2025
  const fyStart = month >= 3 ? year : year - 1;
  return `FY ${fyStart}-${pad2((fyStart + 1) % 100)}`;
}

export function financialYearLabel(key: string): string {
  return key;
}

export function financialYearBounds(key: string): { start: Date; end: Date } {
  const m = key.match(/^FY (\d{4})-(\d{2})$/);
  if (!m) throw new Error(`Invalid FY key: ${key}`);
  const fyStart = parseInt(m[1], 10);
  // FY 2024-25 = Apr 2024 → Mar 2025
  const startUtc = Date.UTC(fyStart, 3, 1) - IST_OFFSET_MS; // Apr 1 IST
  const endUtc = Date.UTC(fyStart + 1, 3, 1) - IST_OFFSET_MS; // next Apr 1 IST
  return { start: new Date(startUtc), end: new Date(endUtc) };
}

// ---------- Generic bucket aggregator ----------

type KeyFn = (d: string) => string;
type LabelFn = (k: string) => string;
type BoundsFn = (k: string) => { start: Date; end: Date };

function aggregate(
  items: AttributionItem[],
  keyFn: KeyFn,
  labelFn: LabelFn,
  boundsFn: BoundsFn
): AttributionBucket[] {
  const valid = items.filter(
    (it) => it.realized_pnl != null && it.exit_filled_at != null
  );
  if (valid.length === 0) return [];

  // Group by key
  const groups = new Map<string, AttributionItem[]>();
  for (const it of valid) {
    const k = keyFn(it.exit_filled_at!);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(it);
  }

  const sortedKeys = Array.from(groups.keys()).sort();
  return sortedKeys.map((k) => {
    const list = groups.get(k)!;
    let netPnl = 0;
    let winCount = 0;
    let lossCount = 0;
    const stratMap = new Map<string, StrategyContribution>();
    for (const it of list) {
      const pnl = it.realized_pnl!;
      netPnl += pnl;
      if (pnl > 0) winCount++;
      else if (pnl < 0) lossCount++;
      const existing = stratMap.get(it.strategy_id);
      if (existing) {
        existing.netPnl += pnl;
        existing.tradeCount += 1;
      } else {
        stratMap.set(it.strategy_id, {
          strategyId: it.strategy_id,
          strategyName: it.strategy_name,
          netPnl: pnl,
          tradeCount: 1,
        });
      }
    }
    const byStrategy = Array.from(stratMap.values()).sort(
      (a, b) => Math.abs(b.netPnl) - Math.abs(a.netPnl)
    );
    const bounds = boundsFn(k);
    return {
      key: k,
      label: labelFn(k),
      startDate: bounds.start,
      endDate: bounds.end,
      netPnl: Number(netPnl.toFixed(2)),
      tradeCount: list.length,
      winCount,
      lossCount,
      byStrategy,
    };
  });
}

export function bucketByMonth(items: AttributionItem[]): AttributionBucket[] {
  return aggregate(items, monthKey, monthLabel, monthBounds);
}

export function bucketByQuarter(items: AttributionItem[]): AttributionBucket[] {
  return aggregate(items, quarterKey, quarterLabel, quarterBounds);
}

export function bucketByFinancialYear(items: AttributionItem[]): AttributionBucket[] {
  return aggregate(items, financialYearKey, financialYearLabel, financialYearBounds);
}
