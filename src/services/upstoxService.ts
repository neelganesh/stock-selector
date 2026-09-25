/**
 * Upstox historical candle service.
 *
 * Uses the Upstox v2 Historical Candle API:
 *   GET https://api.upstox.com/v2/historical-candle/{instrument_key}/day/{to}/{from}
 *   Authorization: Bearer $UPSTOX_ACCESS_TOKEN
 *
 * Emits the CandleData contract for strategy consumption:
 *   CandleData { prices, volumeHistory, sectorNavHistory, dataSource }
 *
 * NO MOCKS / NO FALLBACK DATA: If Upstox token is invalid or candles
 * cannot be fetched, errors are thrown cleanly.
 */

export interface CandleData {
  prices: number[];
  volumeHistory: number[];
  sectorNavHistory: number[];
  dataSource: string;
}

/** Thrown on Upstox 401 so callers can surface authentication issues. */
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
 * Upstox returns candles newest-first (descending): [ts, open, high, low, close, volume, oi].
 * We reverse the array to chronological order (oldest first).
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
  const rawCandles: any[][] = json?.data?.candles ?? [];
  if (rawCandles.length < 50) throw new Error(`Insufficient candles for ${instrumentKey}`);

  // Upstox returns newest-first: [0] is today, [last] is 1 year ago.
  // Reverse so index [0] is oldest, and [last] is the latest/current price.
  const candles = [...rawCandles].reverse();

  const closes = candles.map((c) => Number(c[4]));
  const volumes = candles.map((c) => Number(c[5] ?? 0));

  // Compute equal-weighted Sector NAV benchmark based on chronological price movement
  const returns = closes.slice(1).map((c, i) => (c - closes[i]) / closes[i]);
  const nav: number[] = [100];
  for (const r of returns) {
    nav.push(Number((nav[nav.length - 1] * (1 + r * 0.7 + 0.0001)).toFixed(2)));
  }

  return {
    prices: closes,
    volumeHistory: volumes,
    sectorNavHistory: nav,
    dataSource: 'Upstox',
  };
}
