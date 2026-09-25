/**
 * Real-time Upstox candle data endpoint (server-side proxy).
 *
 * GET /api/candles?keys=KEY1,KEY2,...
 *
 * Takes Upstox instrument keys, fetches 1-year daily candles directly
 * from Upstox API v2 using the server-side UPSTOX_ACCESS_TOKEN.
 *
 * NO MOCKS / NO HARDCODED DATA:
 * - If Upstox token is expired, returns 401.
 * - If an instrument has insufficient history (< 50 candles), returns error for that key.
 * - Reverses descending candles to chronological order for indicator calculations.
 */

import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchCandleData, UpstoxAuthError } from '../src/services/upstoxService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const keysParam = (req.query.keys as string) || (req.query.instrumentKey as string) || '';
  const keys = keysParam.split(',').map((k) => k.trim()).filter(Boolean);

  if (keys.length === 0) {
    return res.status(400).json({ error: 'Missing instrument keys parameter (keys=...)' });
  }

  try {
    const results: Record<string, any> = {};

    await Promise.all(
      keys.map(async (key) => {
        try {
          const data = await fetchCandleData(key);
          results[key] = data;
        } catch (err) {
          if (err instanceof UpstoxAuthError) {
            throw err;
          }
          results[key] = { error: err instanceof Error ? err.message : 'Failed to fetch candles' };
        }
      })
    );

    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
    return res.json({ results });
  } catch (err: any) {
    if (err instanceof UpstoxAuthError) {
      return res.status(401).json({ error: 'Upstox authentication failed. Token expired or invalid.' });
    }
    return res.status(500).json({ error: err?.message || 'Failed to fetch candle data' });
  }
}
