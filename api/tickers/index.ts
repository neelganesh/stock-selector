/**
 * Stock universe API endpoint.
 *
 * GET /api/tickers?cap=large|mid|small|all
 *   Returns the list of tickers for scanner consumption.
 *   Public (no auth) - read-only is enabled via RLS policy.
 *
 *   Response shape:
 *     { tickers: Array<{ symbol, company_name, sector, industry, cap_category }> }
 *
 * Performance: full universe is ~450 rows. With a 1-2 minute server cache
 *   the scanner's repeated calls during a session are essentially free.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// In-memory cache (per serverless instance, lifetime = warm window)
let cache: { data: any[]; ts: number } | null = null;
const CACHE_TTL_MS = 60_000; // 60s

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cap = (req.query.cap as string) || 'all';

  try {
    // Serve from cache when fresh
    if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
      return res.json({ tickers: filterByCap(cache.data, cap) });
    }

    // Otherwise reload
    const { data, error } = await supabaseAdmin
      .from('stock_universe')
      .select('symbol, company_name, sector, industry, cap_category, source_list')
      .order('cap_category', { ascending: true })
      .order('symbol', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    cache = { data: data || [], ts: Date.now() };
    return res.json({ tickers: filterByCap(data || [], cap) });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

function filterByCap(rows: any[], cap: string) {
  if (!cap || cap === 'all') return rows;
  return rows.filter((r) => r.cap_category === cap);
}
