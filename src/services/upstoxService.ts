/**
 * Upstox historical candle service (server-side only).
 *
 * Replaces yfinanceService.ts as the data source. Runs inside the Vercel
 * function in api/scan.ts — never imported by browser code.
 *
 * Uses the Upstox v2 Historical Candle API:
 *   GET https://api.upstox.com/v2/historical-candle/{instrument_key}/day/{to}/{from}
 *   Authorization: Bearer $UPSTOX_ACCESS_TOKEN
 *
 * Emits the same CandleData contract yfinanceService did, so strategy
 * code is untouched:
 *   CandleData { prices, volumeHistory, sectorNavHistory, dataSource }
 */

export interface CandleData {
  prices: number[];
  volumeHistory: number[];
  sectorNavHistory: number[];
  dataSource: string;
}

/** Thrown on Upstox 401 so /api/scan can surface a clear error. */
export class UpstoxAuthError extends Error {
  constructor(message = 'Upstox access token expired or invalid (401)') {
    super(message);
    this.name = 'UpstoxAuthError';
  }
}

const BASE = 'https://api.upstox.com/v2';

function getToken(): string {
  const token = process.env.UPSTOX_ACCESS_TOKEN;
  if (!token) throw new Error('UPSTOX_ACCESS_TOKEN not configured');
  return token;
}

/** Today (to) and one year ago (from) in YYYY-MM-DD. */
function dateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 365 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

/**
 * Fetch 1 year of daily candles for one instrument key.
 * Upstox returns candles oldest-first: [ts, open, high, low, close, volume, oi].
 */
export async function fetchCandleData(instrumentKey: string): Promise<CandleData> {
  const { from, to } = dateRange();
  const url = `${BASE}/historical-candle/${encodeURIComponent(instrumentKey)}/day/${to}/${from}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getToken()}`, Accept: 'application/json' },
  });
  if (res.status === 401) throw new UpstoxAuthError();
  if (!res.ok) throw new Error(`Upstox ${res.status} for ${instrumentKey}`);

  const json = await res.json();
  const candles: any[][] = json?.data?.candles ?? [];
  if (candles.length < 20) throw new Error(`Insufficient candles for ${instrumentKey}`);

  const closes = candles.map((c) => c[4]);
  const volumes = candles.map((c) => c[5] ?? 0);

  // Synthetic equal-weighted sector NAV history derived from this stock's
  // own returns (same heuristic the yfinance service used), so sector
  // relative-strength math keeps working without a per-sector index feed.
  const returns = closes.slice(1).map((c, i) => (c - closes[i]) / closes[i]);
  const nav: number[] = [1];
  for (const r of returns) nav.push(nav[nav.length - 1] * (1 + r * 0.7 + 0.0001));
  nav.shift();

  return {
    prices: closes,
    volumeHistory: volumes,
    sectorNavHistory: nav,
    dataSource: 'Upstox',
  };
}

/** Deterministic synthetic fallback mirroring yfinanceService's seeded generator. */
export function generateFallbackCandles(seed: number): CandleData {
  let s = seed || 1;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  const prices: number[] = [];
  const volumes: number[] = [];
  let price = 100 + rand() * 900;
  for (let i = 0; i < 260; i++) {
    price *= 1 + (rand() - 0.48) * 0.03;
    prices.push(Number(price.toFixed(2)));
    volumes.push(Math.round(100000 + rand() * 900000));
  }
  const returns = prices.slice(1).map((c, i) => (c - prices[i]) / prices[i]);
  const nav: number[] = [1];
  for (const r of returns) nav.push(nav[nav.length - 1] * (1 + r * 0.7 + 0.0001));
  nav.shift();
  return { prices, volumeHistory: volumes, sectorNavHistory: nav, dataSource: 'Fallback' };
}
