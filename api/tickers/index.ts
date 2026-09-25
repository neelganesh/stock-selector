/**
 * Stock universe API endpoint.
 *
 * GET /api/tickers?cap=large|mid|small|all
 *   Returns the list of tickers for scanner consumption.
 *   Public (no auth) - read-only is enabled via RLS policy.
 *
 *   Response shape:
 *     { tickers: Array<{ symbol, company_name, sector, industry, cap_category, instrument_key }> }
 */

import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Supabase server environment is not configured');
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
    if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
      return res.json({ tickers: filterByCap(cache.data, cap) });
    }

    const { data, error } = await supabaseAdmin
      .from('stock_universe')
      .select('symbol, company_name, sector, industry, cap_category, source_list, instrument_key')
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
